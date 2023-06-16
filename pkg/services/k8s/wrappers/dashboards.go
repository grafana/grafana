package wrappers

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type DashboardStoreWrapper struct {
	database.DashboardSQLStore
	log       log.Logger
	clientset client.ClientSetProvider
	namespace string
	folders   folder.FolderStore
}

var _ dashboards.Store = (*DashboardStoreWrapper)(nil)

func ProvideDashboardStoreWrapper(
	features featuremgmt.FeatureToggles,
	store database.DashboardSQLStore,
	clientset client.ClientSetProvider,
	folders folder.FolderStore,
) (dashboards.Store, error) {
	if !features.IsEnabled(featuremgmt.FlagEntityStore) {
		return store, nil
	}

	return &DashboardStoreWrapper{
		DashboardSQLStore: store,
		log:               log.New("k8s.dashboards.service-wrapper"),
		clientset:         clientset,
		namespace:         "default",
		folders:           folders,
	}, nil
}

// SaveDashboard saves the dashboard to kubernetes
func (s *DashboardStoreWrapper) SaveDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand) (*dashboards.Dashboard, error) {
	// Same save path but with additional metadata
	return s.SaveProvisionedDashboard(ctx, cmd, nil)
}

type genericDashboardResource = kinds.GrafanaResource[simplejson.Json, interface{}]

// SaveDashboard will write the dashboard to k8s then wait for it to exist in the SQL store
func (s *DashboardStoreWrapper) SaveProvisionedDashboard(ctx context.Context, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	if cmd.Dashboard == nil {
		return nil, fmt.Errorf("no dashboard data")
	}

	namespace := util.OrgIdToNamespace(cmd.OrgID)
	dashboardResource, err := s.clientset.GetClientset().GetResourceClient(schema.GroupVersionKind{
		Group:   "core.kinds.grafana.com",
		Version: "v0-alpha",
		Kind:    "Dashboard",
	}, namespace)
	if err != nil {
		return nil, fmt.Errorf("ProvideServiceWrapper failed to get dashboard resource client: %w", err)
	}

	res := genericDashboardResource{
		Metadata: kinds.GrafanaResourceMetadata{
			Annotations: make(map[string]string),
		},
	}
	res.Metadata.SetCommitMessage(cmd.Message)

	// Set the resource folder
	if cmd.FolderUID != "" {
		res.Metadata.SetFolder(cmd.FolderUID)
	} else if cmd.FolderID > 0 {
		f, err := s.folders.GetFolderByID(ctx, cmd.OrgID, cmd.FolderID)
		if err != nil {
			return nil, err
		}
		res.Metadata.SetFolder(f.UID)
	}

	if provisioning != nil {
		res.Metadata.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name:      provisioning.Name,
			Path:      provisioning.ExternalID,
			Key:       provisioning.CheckSum,
			Timestamp: util.Pointer(time.UnixMilli(provisioning.Updated)),
		})
	} else if cmd.PluginID != "" {
		res.Metadata.SetOriginInfo(&kinds.ResourceOriginInfo{
			Name: "plugin",
			Key:  cmd.PluginID,
		})
	}

	res.Metadata.Namespace = util.OrgIdToNamespace(cmd.OrgID)

	dto := cmd.GetDashboardModel()
	if dto.UID == "" {
		res.Metadata.GenerateName = "auto" // will create a new UID
	} else {
		res.Metadata.Name = dto.UID
		res.Metadata.GenerateName = ""
	}

	if cmd.IsFolder {
		res.APIVersion = "core.kinds.grafana.com/v0-alpha"
		res.Kind = "Folder"
		res.Spec = cmd.Dashboard

		if provisioning == nil {
			return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
		}
		return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
	}

	// Dashboard versions
	res.APIVersion = "core.kinds.grafana.com/v0-alpha"
	res.Kind = "Dashboard"
	res.Spec = cmd.Dashboard

	rv := ""
	r, err := dashboardResource.Get(ctx, dto.UID, metav1.GetOptions{})
	if err != nil || r == nil {
		fmt.Printf("did not find: %s\n", dto.UID)
	} else {
		if !cmd.Overwrite {
			fmt.Printf("TODO... verify SQL version: %s\n", r.GetResourceVersion())
		}
		rv = r.GetResourceVersion()
		res.Metadata.ResourceVersion = rv
	}

	out, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&res)
	if err != nil {
		return nil, err
	}
	uObj := &unstructured.Unstructured{Object: out}
	if rv == "" {
		s.log.Debug("k8s action: create")
		uObj, err = dashboardResource.Create(ctx, uObj, metav1.CreateOptions{})
	} else {
		s.log.Debug("k8s action: update")
		uObj, err = dashboardResource.Update(ctx, uObj, metav1.UpdateOptions{})
	}
	if err != nil {
		return nil, err
	}
	js, _ := json.Marshal(uObj)
	err = json.Unmarshal(js, &res)
	if err != nil {
		return nil, err
	}

	// TODO! depend on the write command above to make synchronous call to SQL storage

	// dash := &dashboards.Dashboard{
	// 	UID:  res.Metadata.Name,
	// 	Data: res.Spec,
	// }
	// dash.ID = res.Spec.Get("id").MustInt64(0)
	// dash.Version = res.Spec.Get("version").MustInt()
	// dash.UpdateSlug()
	// return dash, nil

	// Finally fall though to the standard SQL
	if provisioning == nil {
		return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
	}
	return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
}
