package wrappers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type DashboardStoreWrapper struct {
	database.DashboardSQLStore
	log log.Logger
	//	clientset client.ClientSetProvider
	namespace string
	folders   folder.FolderStore
}

var _ dashboards.Store = (*DashboardStoreWrapper)(nil)

func ProvideDashboardStoreWrapper(
	features featuremgmt.FeatureToggles,
	store database.DashboardSQLStore,
	//	clientset client.ClientSetProvider,
	folders folder.FolderStore,
) (dashboards.Store, error) {
	if !features.IsEnabled(featuremgmt.FlagEntityStore) {
		return store, nil
	}

	return &DashboardStoreWrapper{
		DashboardSQLStore: store,
		log:               log.New("k8s.dashboards.service-wrapper"),
		//	clientset:         clientset,
		namespace: "default",
		folders:   folders,
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

	if cmd.OrgID == 1 {
		res.Metadata.Namespace = "default"
	} else {
		res.Metadata.Namespace = fmt.Sprintf("org-%d", cmd.OrgID)
	}

	dto := cmd.GetDashboardModel()
	if dto.UID == "" {
		res.Metadata.GenerateName = "auto" // will create a new UID
	} else {
		res.Metadata.GenerateName = ""
	}

	if cmd.IsFolder {
		return s.saveFolder(ctx, &res, cmd, provisioning)
	}

	// Now handled by entity api
	// 	UpdatedAt: cmd.UpdatedAt.UnixMilli(),
	// 	UpdatedBy: cmd.UserID,

	// // Save provisioning info
	// if provisioning != nil {
	// 	anno.OriginName = provisioning.Name
	// 	anno.OriginPath = provisioning.ExternalID
	// 	anno.OriginKey = provisioning.CheckSum
	// 	anno.OriginTime = provisioning.Updated
	// }

	// // FIXME this is not reliable and is spaghetti
	// dto := cmd.GetDashboardModel()
	// uid := dto.UID
	// if uid == "" {
	// 	uid = util.GenerateShortUID()
	// 	meta.Name = GrafanaUIDToK8sName(uid)
	// } else {
	// 	// Get the previous version
	// 	meta.Name = GrafanaUIDToK8sName(uid)
	// 	r, err := dashboardResource.Get(ctx, meta.Name, metav1.GetOptions{})
	// 	if err != nil || r == nil {
	// 		fmt.Printf("did not find: %s\n", uid)
	// 	} else {
	// 		if !cmd.Overwrite {
	// 			fmt.Printf("TODO... verify SQL version: %s\n", r.GetResourceVersion())
	// 		}

	// 		// Keep old metadata
	// 		meta.ResourceVersion = r.GetResourceVersion()
	// 		anno.Merge(r.GetAnnotations())
	// 		if anno.CreatedAt < 100 {
	// 			anno.CreatedAt = r.GetCreationTimestamp().UnixMilli()
	// 		}
	// 	}
	// }

	// dto.Data.Del("id") // internal ID should not be saved in k8s
	// dto.Data.Set("uid", uid)
	// dto.UID = uid

	// // strip nulls...
	// stripNulls(dto.Data)

	// if anno.CreatedAt < 1 {
	// 	anno.CreatedAt = time.Now().UnixMilli()
	// }
	// if anno.CreatedBy < 1 {
	// 	anno.CreatedBy = anno.UpdatedBy
	// }
	// anno.Message = fmt.Sprintf("%s (previous resourceVersion: %s)", cmd.Message, meta.ResourceVersion)
	// meta.Annotations = anno.ToMap()
	// uObj, err := dtoToUnstructured(dto, meta)
	// if err != nil {
	// 	return nil, err
	// }

	// // js, _ := json.MarshalIndent(uObj, "", "  ")
	// // fmt.Printf("-------- WRAPPER BEFORE SAVE ---------")
	// // fmt.Printf("%s", string(js))

	// if meta.ResourceVersion == "" {
	// 	s.log.Debug("k8s action: create")
	// 	uObj, err = dashboardResource.Create(ctx, uObj, metav1.CreateOptions{})
	// } else {
	// 	s.log.Debug("k8s action: update")
	// 	uObj, err = dashboardResource.Update(ctx, uObj, metav1.UpdateOptions{})
	// }

	// // create or update error
	// if err != nil {
	// 	return nil, err
	// }

	res.APIVersion = "dashboard.kinds.grafana.com/v0.0-alpha"
	res.Kind = "dashboard"
	res.Spec = cmd.Dashboard

	jj, _ := json.MarshalIndent(res, "", "  ")
	fmt.Printf("TODO, SAVE k8s dashboard: %s\n", jj)

	if false {
		uid := "xxx"
		return s.waitForRevision(ctx,
			&dashboards.GetDashboardQuery{UID: uid, OrgID: dto.OrgID},
			"1") // uObj.GetResourceVersion())
	}

	if provisioning == nil {
		return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
	}
	return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
}

// SaveDashboard will write the dashboard to k8s then wait for it to exist in the SQL store
func (s *DashboardStoreWrapper) saveFolder(ctx context.Context, res *genericDashboardResource, cmd dashboards.SaveDashboardCommand, provisioning *dashboards.DashboardProvisioning) (*dashboards.Dashboard, error) {
	if !cmd.IsFolder {
		return nil, fmt.Errorf("expected folder")
	}
	res.APIVersion = "folder.kinds.grafana.com/v0.0-alpha"
	res.Kind = "folder"
	res.Spec = cmd.Dashboard

	jj, _ := json.MarshalIndent(res, "", "  ")
	fmt.Printf("TODO, SAVE k8s folder: %s\n", jj)

	if provisioning == nil {
		return s.DashboardSQLStore.SaveDashboard(ctx, cmd)
	}
	return s.DashboardSQLStore.SaveProvisionedDashboard(ctx, cmd, provisioning)
}

func (s *DashboardStoreWrapper) waitForRevision(ctx context.Context, query *dashboards.GetDashboardQuery, rv string) (*dashboards.Dashboard, error) {
	s.log.Debug("wait for revision", "revision", rv)

	// TODO: rather than polling the dashboard service,
	// we could write a status field and listen for changes on that status from k8s directly
	// however, this is likely better since it is checking the SQL instance that needs to be valid
	for i := 0; i < 9; i++ {
		time.Sleep(175 * time.Millisecond)
		out, err := s.DashboardSQLStore.GetDashboard(ctx, query)
		if err != nil {
			if !errors.Is(err, dashboards.ErrDashboardNotFound) {
				fmt.Printf("ERROR: %v", err)
			}
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
	return nil, fmt.Errorf("controller never ran? " + query.UID)
}
