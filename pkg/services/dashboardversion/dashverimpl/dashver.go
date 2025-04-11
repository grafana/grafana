package dashverimpl

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
			dashv1.DashboardResourceInfo.GroupVersionResource(),
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

func (s *Service) getHistoryThroughK8s(ctx context.Context, orgID int64, dashboardUID string, version int64) (*dashver.DashboardVersionDTO, error) {
	// this is an unideal implementation - we have to list all versions and filter here, since there currently is no way to query for the
	// generation id in unified storage, so we cannot query for the dashboard version directly, and we cannot use search as history is not indexed.
	// use batches to make sure we don't load too much data at once.
	const batchSize = 50
	labelSelector := utils.LabelKeyGetHistory + "=" + dashboardUID
	var continueToken string
	for {
		out, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
			LabelSelector: labelSelector,
			Limit:         int64(batchSize),
			Continue:      continueToken,
		})
		if err != nil {
			if apierrors.IsNotFound(err) {
				return nil, dashboards.ErrDashboardNotFound
			}
			return nil, err
		}
		if out == nil {
			return nil, dashboards.ErrDashboardNotFound
		}

		for _, item := range out.Items {
			if item.GetGeneration() == version {
				return s.UnstructuredToLegacyDashboardVersion(ctx, &item, orgID)
			}
		}

		continueToken = out.GetContinue()
		if continueToken == "" || len(out.Items) == 0 {
			break
		}
	}

	return nil, dashboards.ErrDashboardNotFound
}

func (s *Service) listHistoryThroughK8s(ctx context.Context, orgID int64, dashboardUID string, limit int64, continueToken string) (*dashver.DashboardVersionResponse, error) {
	out, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
		LabelSelector: utils.LabelKeyGetHistory + "=" + dashboardUID,
		Limit:         limit,
		Continue:      continueToken,
	})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil, dashboards.ErrDashboardNotFound
		}

		return nil, err
	}
	if out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	dashboards, err := s.UnstructuredToLegacyDashboardVersionList(ctx, out.Items, orgID)
	if err != nil {
		return nil, err
	}

	return &dashver.DashboardVersionResponse{
		ContinueToken: out.GetContinue(),
		Versions:      dashboards,
	}, nil
}

func (s *Service) UnstructuredToLegacyDashboardVersion(ctx context.Context, item *unstructured.Unstructured, orgID int64) (*dashver.DashboardVersionDTO, error) {
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	users, err := s.k8sclient.GetUsersFromMeta(ctx, []string{obj.GetCreatedBy(), obj.GetUpdatedBy()})
	if err != nil {
		return nil, err
	}
	return s.unstructuredToLegacyDashboardVersionWithUsers(item, users)
}

func (s *Service) UnstructuredToLegacyDashboardVersionList(ctx context.Context, items []unstructured.Unstructured, orgID int64) ([]*dashver.DashboardVersionDTO, error) {
	// get users ahead of time to do just one db call, rather than 2 per item in the list
	userMeta := []string{}
	for _, item := range items {
		obj, err := utils.MetaAccessor(&item)
		if err != nil {
			return nil, err
		}
		if obj.GetCreatedBy() != "" {
			userMeta = append(userMeta, obj.GetCreatedBy())
		}
		if obj.GetUpdatedBy() != "" {
			userMeta = append(userMeta, obj.GetUpdatedBy())
		}
	}

	users, err := s.k8sclient.GetUsersFromMeta(ctx, userMeta)
	if err != nil {
		return nil, err
	}

	versions := make([]*dashver.DashboardVersionDTO, len(items))
	for i, item := range items {
		version, err := s.unstructuredToLegacyDashboardVersionWithUsers(&item, users)
		if err != nil {
			return nil, err
		}
		versions[i] = version
	}

	return versions, nil
}

func (s *Service) unstructuredToLegacyDashboardVersionWithUsers(item *unstructured.Unstructured, users map[string]*user.User) (*dashver.DashboardVersionDTO, error) {
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

	dashVersion := obj.GetGeneration()
	parentVersion := dashVersion - 1
	if parentVersion < 0 {
		parentVersion = 0
	}
	if dashVersion > 0 {
		spec["version"] = dashVersion
	}

	var createdBy *user.User
	if creator, ok := users[obj.GetCreatedBy()]; ok {
		createdBy = creator
	}
	// if updated by is set, then this version of the dashboard was "created"
	// by that user
	if updater, ok := users[obj.GetUpdatedBy()]; ok {
		createdBy = updater
	}

	createdByID := int64(0)
	if createdBy != nil {
		createdByID = createdBy.ID
	}

	created := obj.GetCreationTimestamp().Time
	if updated, err := obj.GetUpdatedTimestamp(); err == nil && updated != nil {
		created = *updated
	}

	restoreVer, err := getRestoreVersion(obj.GetMessage())
	if err != nil {
		return nil, err
	}

	return &dashver.DashboardVersionDTO{
		ID:            dashVersion,
		DashboardID:   obj.GetDeprecatedInternalID(), // nolint:staticcheck
		DashboardUID:  uid,
		Created:       created,
		CreatedBy:     createdByID,
		Message:       obj.GetMessage(),
		RestoredFrom:  restoreVer,
		Version:       int(dashVersion),
		ParentVersion: int(parentVersion),
		Data:          simplejson.NewFromAny(spec),
	}, nil
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
