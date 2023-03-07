package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type StoreWrapper struct {
	database.DashboardSQLStore
	log       log.Logger
	clientset *client.Clientset
	namespace string
}

var _ dashboards.Store = (*StoreWrapper)(nil)

func ProvideStoreWrapper(
	features featuremgmt.FeatureToggles,
	store database.DashboardSQLStore,
	clientset *client.Clientset,
) (dashboards.Store, error) {
	// When feature is disabled, resolve the upstream SQL store
	if !features.IsEnabled(featuremgmt.FlagK8s) {
		return store, nil
	}
	return &StoreWrapper{
		DashboardSQLStore: store,
		log:               log.New("k8s.dashboards.service-wrapper"),
		clientset:         clientset,
		namespace:         "default",
	}, nil
}

// SaveDashboard will write the dashboard to k8s then wait for it to exist in the SQL store
func (s *StoreWrapper) SaveDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	dashboardResource, err := s.clientset.GetResourceClient(CRD)
	if err != nil {
		return nil, fmt.Errorf("ProvideServiceWrapper failed to get dashboard resource client: %w", err)
	}

	if cmd.Dashboard == nil {
		return nil, fmt.Errorf("dashboard data is nil")
	}

	updateDashboard := false
	resourceVersion := ""

	// FIXME this is not reliable and is spaghetti
	dto := cmd.GetDashboardModel()
	uid := dto.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	} else {
		// check if dashboard exists in k8s. if it does, we're gonna do an update, if
		rv, ok, err := getResourceVersion(ctx, dashboardResource, uid)
		if !ok {
			return nil, err
		}

		fmt.Printf("VERSION: %s", rv)
		// if rv != "" {
		// 	if !dto.Overwrite {
		// 		dtoRV := dto.Dashboard.Data.Get("resourceVersion").MustString()
		// 		if dtoRV != "" && dtoRV != rv {
		// 			return nil, dashboards.ErrDashboardVersionMismatch
		// 		}
		// 	}

		// 	// exists in k8s
		// 	updateDashboard = true
		// 	resourceVersion = rv
		// }
	}

	// HACK, remove empty ID!!
	dto.Data.Del("id")
	dto.Data.Set("uid", uid)
	dto.UID = uid
	// strip nulls...
	stripNulls(dto.Data)

	dashbytes, err := dto.Data.MarshalJSON()
	if err != nil {
		return nil, err
	}

	d, _, err := coreReg.Dashboard().JSONValueMux(dashbytes)
	if err != nil {
		return nil, fmt.Errorf("dashboard JSONValueMux failed: %w", err)
	}

	if d.Uid == nil {
		d.Uid = &uid
	}

	if d.Title == nil {
		d.Title = &dto.Title
	}

	meta := metav1.ObjectMeta{
		Name:        uid,
		Namespace:   s.namespace,
		Annotations: annotationsFromDashboardCMD(cmd, dto),
	}

	if resourceVersion != "" {
		meta.ResourceVersion = resourceVersion
	}

	uObj, err := toUnstructured(d, meta)
	if err != nil {
		return nil, err
	}

	js, _ := json.MarshalIndent(uObj, "", "  ")
	fmt.Printf("-------- UNSTRUCTURED BEFORE---------")
	fmt.Printf("%s", string(js))

	if updateDashboard {
		s.log.Debug("k8s action: update")
		uObj, err = dashboardResource.Update(ctx, uObj, metav1.UpdateOptions{})
	} else {
		s.log.Debug("k8s action: create")
		uObj, err = dashboardResource.Create(ctx, uObj, metav1.CreateOptions{})
	}

	// create or update error
	if err != nil {
		return nil, err
	}

	js, _ = json.MarshalIndent(uObj, "", "  ")
	fmt.Printf("-------- UNSTRUCTURED AFTER---------")
	fmt.Printf("%s", string(js))

	rv := uObj.GetResourceVersion()
	s.log.Debug("wait for revision", "revision", rv)

	// TODO: rather than polling the dashboard service,
	// we could write a status field and listen for changes on that status from k8s directly
	for i := 0; i < 5; i++ {
		time.Sleep(150 * time.Millisecond)
		out, err := s.DashboardSQLStore.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: uid, OrgID: dto.OrgID})
		if err != nil {
			fmt.Printf("ERROR: %v", err)
			continue
		}
		if out != nil && out.Data != nil {
			savedRV := out.Data.Get("resourceVersion").MustString()
			if savedRV == rv {
				return out, nil
			} else {
				fmt.Printf("NO MATCH: %v\n", out)
			}
		}
	}

	// too many loops?
	return nil, fmt.Errorf("controller never ran?")
}

// SaveDashboard saves the dashboard to kubernetes
func (s *StoreWrapper) SaveProvisionedDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	fmt.Printf("SaveProvisionedDashboard: %s // %s\n", cmd.Dashboard.MustString("uid"), provisioning.ExternalID)
	return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
}
