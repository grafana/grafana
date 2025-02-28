package dashverimpl

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	maxVersionsToDeletePerBatch = 100
	maxVersionDeletionBatches   = 50
)

type Service struct {
	cfg       *setting.Cfg
	store     store
	dashSvc   dashboards.DashboardService
	k8sclient client.K8sHandler
	features  featuremgmt.FeatureToggles
	log       log.Logger
}

func ProvideService(cfg *setting.Cfg, db db.DB, dashboardService dashboards.DashboardService, dashboardStore dashboards.Store, features featuremgmt.FeatureToggles,
	restConfigProvider apiserver.RestConfigProvider, userService user.Service, unified resource.ResourceClient, dual dualwrite.Service, sorter sort.Service) dashver.Service {
	return &Service{
		cfg: cfg,
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		features: features,
		k8sclient: client.NewK8sHandler(
			dual,
			request.GetNamespaceMapper(cfg),
			v0alpha1.DashboardResourceInfo.GroupVersionResource(),
			restConfigProvider.GetRestConfig,
			dashboardStore,
			userService,
			unified,
			sorter,
		),
		dashSvc: dashboardService,
		log:     log.New("dashboard-version"),
	}
}

func (s *Service) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersionDTO, error) {
	// Get the DashboardUID if not populated
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	// The store methods require the dashboard ID (uid is not in the dashboard
	// versions table, at time of this writing), so get the DashboardID if it
	// was not populated.
	if query.DashboardID == 0 {
		id, err := s.getDashIDMaybeEmpty(ctx, query.DashboardUID, query.OrgID)
		if err != nil {
			return nil, err
		}
		query.DashboardID = id
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		version, err := s.getHistoryThroughK8s(ctx, query.OrgID, query.DashboardUID, query.Version)
		if err != nil {
			return nil, err
		}
		return version, nil
	}

	version, err := s.store.Get(ctx, query)
	if err != nil {
		return nil, err
	}
	version.Data.Set("id", version.DashboardID)
	return version.ToDTO(query.DashboardUID), nil
}

func (s *Service) DeleteExpired(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand) error {
	versionsToKeep := s.cfg.DashboardVersionsToKeep
	if versionsToKeep < 1 {
		versionsToKeep = 1
	}

	for batch := 0; batch < maxVersionDeletionBatches; batch++ {
		versionIdsToDelete, batchErr := s.store.GetBatch(ctx, cmd, maxVersionsToDeletePerBatch, versionsToKeep)
		if batchErr != nil {
			return batchErr
		}

		if len(versionIdsToDelete) < 1 {
			return nil
		}

		deleted, err := s.store.DeleteBatch(ctx, cmd, versionIdsToDelete)
		if err != nil {
			return err
		}

		cmd.DeletedRows += deleted

		if deleted < int64(maxVersionsToDeletePerBatch) {
			break
		}
	}
	return nil
}

// List all dashboard versions for the given dashboard ID.
func (s *Service) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) (*dashver.DashboardVersionResponse, error) {
	// Get the DashboardUID if not populated
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	// The store methods require the dashboard ID (uid is not in the dashboard
	// versions table, at time of this writing), so get the DashboardID if it
	// was not populated.
	if query.DashboardID == 0 {
		id, err := s.getDashIDMaybeEmpty(ctx, query.DashboardUID, query.OrgID)
		if err != nil {
			return nil, err
		}
		query.DashboardID = id
	}
	if query.Limit == 0 {
		query.Limit = 1000
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesClientDashboardsFolders) {
		versions, err := s.listHistoryThroughK8s(
			ctx,
			query.OrgID,
			query.DashboardUID,
			int64(query.Limit),
			query.ContinueToken,
		)
		if err != nil {
			return nil, err
		}
		return versions, nil
	}

	dvs, err := s.store.List(ctx, query)
	if err != nil {
		return nil, err
	}
	dtos := make([]*dashver.DashboardVersionDTO, len(dvs))
	for i, v := range dvs {
		dtos[i] = v.ToDTO(query.DashboardUID)
	}
	return &dashver.DashboardVersionResponse{
		Versions: dtos,
	}, nil
}

// getDashUIDMaybeEmpty is a helper function which takes a dashboardID and
// returns the UID. If the dashboard is not found, it will return an empty
// string.
func (s *Service) getDashUIDMaybeEmpty(ctx context.Context, id int64) (string, error) {
	q := dashboards.GetDashboardRefByIDQuery{ID: id}
	result, err := s.dashSvc.GetDashboardUIDByID(ctx, &q)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			s.log.Debug("dashboard not found")
			return "", nil
		} else {
			s.log.Error("error getting dashboard", err)
			return "", err
		}
	}
	return result.UID, nil
}

// getDashIDMaybeEmpty is a helper function which takes a dashboardUID and
// returns the ID. If the dashboard is not found, it will return -1.
func (s *Service) getDashIDMaybeEmpty(ctx context.Context, uid string, orgID int64) (int64, error) {
	q := dashboards.GetDashboardQuery{UID: uid, OrgID: orgID}
	result, err := s.dashSvc.GetDashboard(ctx, &q)
	if err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			s.log.Debug("dashboard not found")
			return -1, nil
		} else {
			s.log.Error("error getting dashboard", err)
			return -1, err
		}
	}
	return result.ID, nil
}

func (s *Service) getHistoryThroughK8s(ctx context.Context, orgID int64, dashboardUID string, rv int64) (*dashver.DashboardVersionDTO, error) {
	out, err := s.k8sclient.Get(ctx, dashboardUID, orgID, v1.GetOptions{ResourceVersion: strconv.FormatInt(rv, 10)})
	if err != nil {
		return nil, err
	} else if out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	dash, err := s.UnstructuredToLegacyDashboardVersion(ctx, out, orgID)
	if err != nil {
		return nil, err
	}

	return dash, nil
}

func (s *Service) listHistoryThroughK8s(ctx context.Context, orgID int64, dashboardUID string, limit int64, continueToken string) (*dashver.DashboardVersionResponse, error) {
	out, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
		LabelSelector: utils.LabelKeyGetHistory + "=" + dashboardUID,
		Limit:         limit,
		Continue:      continueToken,
	})
	if err != nil {
		return nil, err
	} else if out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	dashboards := make([]*dashver.DashboardVersionDTO, len(out.Items))
	for i, item := range out.Items {
		dash, err := s.UnstructuredToLegacyDashboardVersion(ctx, &item, orgID)
		if err != nil {
			return nil, err
		}
		dashboards[i] = dash
	}

	return &dashver.DashboardVersionResponse{
		ContinueToken: out.GetContinue(),
		Versions:      dashboards,
	}, nil
}

func (s *Service) UnstructuredToLegacyDashboardVersion(ctx context.Context, item *unstructured.Unstructured, orgID int64) (*dashver.DashboardVersionDTO, error) {
	spec, ok := item.Object["spec"].(map[string]any)
	if !ok {
		return nil, errors.New("error parsing dashboard from k8s response")
	}
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	uid := obj.GetName()
	spec["uid"] = uid

	dashVersion := 0
	parentVersion := 0
	if version, ok := spec["version"].(int64); ok {
		dashVersion = int(version)
		parentVersion = dashVersion - 1
	}

	createdBy, err := s.k8sclient.GetUserFromMeta(ctx, obj.GetCreatedBy())
	if err != nil {
		return nil, err
	}

	// if updated by is set, then this version of the dashboard was "created"
	// by that user
	if obj.GetUpdatedBy() != "" {
		updatedBy, err := s.k8sclient.GetUserFromMeta(ctx, obj.GetUpdatedBy())
		if err == nil && updatedBy != nil {
			createdBy = updatedBy
		}
	}

	id, err := obj.GetResourceVersionInt64()
	if err != nil {
		return nil, err
	}

	restoreVer, err := getRestoreVersion(obj.GetMessage())
	if err != nil {
		return nil, err
	}

	out := dashver.DashboardVersionDTO{
		ID:            id,
		DashboardID:   obj.GetDeprecatedInternalID(), // nolint:staticcheck
		DashboardUID:  uid,
		Created:       obj.GetCreationTimestamp().Time,
		CreatedBy:     createdBy.ID,
		Message:       obj.GetMessage(),
		RestoredFrom:  restoreVer,
		Version:       dashVersion,
		ParentVersion: parentVersion,
		Data:          simplejson.NewFromAny(spec),
	}

	return &out, nil
}

var restoreMsg = "Restored from version "

func DashboardRestoreMessage(version int) string {
	return fmt.Sprintf("%s%d", restoreMsg, version)
}

func getRestoreVersion(msg string) (int, error) {
	parts := strings.Split(msg, restoreMsg)
	if len(parts) < 2 {
		return 0, nil
	}

	ver, err := strconv.Atoi(parts[1])
	if err != nil {
		return 0, err
	}
	return ver, nil
}
