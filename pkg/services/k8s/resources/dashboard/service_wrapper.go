package dashboard

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/service"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/util"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type ServiceWrapper struct {
	dashboards.DashboardService
	log               log.Logger
	clientsetProvider client.ClientSetProvider
	namespace         string
}

var _ dashboards.DashboardService = (*ServiceWrapper)(nil)

func ProvideServiceWrapper(
	dashboardService *service.DashboardServiceImpl,
	clientsetProvider client.ClientSetProvider,
) (*ServiceWrapper, error) {

	return &ServiceWrapper{
		DashboardService:  dashboardService,
		log:               log.New("k8s.dashboards.service-wrapper"),
		clientsetProvider: clientsetProvider,
		namespace:         "default",
	}, nil
}

// SaveDashboard saves the dashboard to kubernetes
func (s *ServiceWrapper) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO, allowUiUpdate bool) (*dashboards.Dashboard, error) {
	clientset := s.clientsetProvider.GetClientset()
	dashboardResource, err := clientset.GetResourceClient(CRD)
	if err != nil {
		return nil, fmt.Errorf("ProvideServiceWrapper failed to get dashboard resource client: %w", err)
	}

	updateDashboard := false
	resourceVersion := ""

	// FIXME this is not reliable and is spaghetti
	uid := dto.Dashboard.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	} else {
		// check if dashboard exists in k8s. if it does, we're gonna do an update, if
		rv, ok, err := getResourceVersion(ctx, dashboardResource, uid)
		if !ok {
			return nil, err
		}

		if rv != "" {
			if !dto.Overwrite {
				dtoRV := dto.Dashboard.Data.Get("resourceVersion").MustString()
				if dtoRV != "" && dtoRV != rv {
					return nil, dashboards.ErrDashboardVersionMismatch
				}
			}

			// exists in k8s
			updateDashboard = true
			resourceVersion = rv
		}
	}

	if dto.Dashboard.Data == nil {
		return nil, fmt.Errorf("dashboard data is nil")
	}

	// HACK, remove empty ID!!
	dto.Dashboard.Data.Del("id")
	dto.Dashboard.Data.Set("uid", uid)
	dto.Dashboard.UID = uid
	// strip nulls...
	stripNulls(dto.Dashboard.Data)

	dashbytes, err := dto.Dashboard.Data.MarshalJSON()
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
		d.Title = &dto.Dashboard.Title
	}

	meta := metav1.ObjectMeta{
		Name:        uid,
		Namespace:   s.namespace,
		Annotations: annotationsFromDashboardDTO(dto),
	}

	if resourceVersion != "" {
		meta.ResourceVersion = resourceVersion
	}

	uObj, err := toUnstructured(d, meta)
	if err != nil {
		return nil, err
	}

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

	rv := uObj.GetResourceVersion()
	s.log.Debug("wait for revision", "revision", rv)

	// TODO: rather than polling the dashboard service,
	// we could write a status field and listen for changes on that status from k8s directly
	for i := 0; i < 5; i++ {
		time.Sleep(150 * time.Millisecond)
		out, err := s.DashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: uid, OrgID: dto.OrgID})
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

	return nil, fmt.Errorf("controller never ran?")
}
