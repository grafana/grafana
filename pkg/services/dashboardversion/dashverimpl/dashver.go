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

	dashboardv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardclient "github.com/grafana/grafana/pkg/services/dashboards/service/client"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxVersionsToDeletePerBatch = 100
	maxVersionDeletionBatches   = 50
)

type Service struct {
	cfg       *setting.Cfg
	store     store
	dashSvc   dashboards.DashboardService
	k8sclient dashboardclient.K8sHandlerWithFallback
	features  featuremgmt.FeatureToggles
	log       log.Logger
}

func ProvideService(
	cfg *setting.Cfg,
	db db.DB,
	dashboardService dashboards.DashboardService,
	features featuremgmt.FeatureToggles,
	clientWithFallback dashboardclient.K8sHandlerWithFallback,
) dashver.Service {
	return &Service{
		cfg: cfg,
		store: &sqlStore{
			db:      db,
			dialect: db.GetDialect(),
		},
		features:  features,
		k8sclient: clientWithFallback,
		dashSvc:   dashboardService,
		log:       log.New("dashboard-version"),
	}
}

func (s *Service) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersionDTO, error) {
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	version, err := s.getHistoryThroughK8s(ctx, query.OrgID, query.DashboardUID, query.Version)
	if err != nil {
		return nil, err
	}
	return version, nil
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
	if query.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, query.DashboardID)
		if err != nil {
			return nil, err
		}
		query.DashboardUID = u
	}

	if query.Limit == 0 {
		query.Limit = 1000
	}

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

func (s *Service) getHistoryThroughK8s(ctx context.Context, orgID int64, dashboardUID string, version int64) (*dashver.DashboardVersionDTO, error) {
	// this is an unideal implementation - we have to list all versions and filter here, since there currently is no way to query for the
	// generation id in unified storage, so we cannot query for the dashboard version directly, and we cannot use search as history is not indexed.
	// use batches to make sure we don't load too much data at once.
	const batchSize = 50
	labelSelector := utils.LabelKeyGetHistory + "=true"
	fieldSelector := "metadata.name=" + dashboardUID
	var continueToken string
	for {
		out, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
			LabelSelector: labelSelector,
			FieldSelector: fieldSelector,
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
	labelSelector := utils.LabelKeyGetHistory + "=true"
	fieldSelector := "metadata.name=" + dashboardUID
	out, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
		LabelSelector: labelSelector,
		FieldSelector: fieldSelector,
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

	// if k8s returns a continue token, we need to fetch the next page(s) until we either reach the limit or there are no more pages
	continueToken = out.GetContinue()
	for (len(out.Items) < int(limit)) && (continueToken != "") {
		tempOut, err := s.k8sclient.List(ctx, orgID, v1.ListOptions{
			LabelSelector: labelSelector,
			FieldSelector: fieldSelector,
			Continue:      continueToken,
			Limit:         limit - int64(len(out.Items)),
		})
		if err != nil {
			return nil, err
		}
		out.Items = append(out.Items, tempOut.Items...)
		continueToken = tempOut.GetContinue()
	}

	dashboards, err := s.UnstructuredToLegacyDashboardVersionList(ctx, out.Items, orgID)
	if err != nil {
		return nil, err
	}

	return &dashver.DashboardVersionResponse{
		ContinueToken: continueToken,
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
	var vspec DashboardVersionSpec
	if err := UnstructuredToDashboardVersionSpec(item, &vspec); err != nil {
		return nil, err
	}

	obj := vspec.MetaAccessor

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
		ID:            vspec.Version,
		DashboardID:   obj.GetDeprecatedInternalID(), // nolint:staticcheck
		DashboardUID:  vspec.UID,
		Created:       created,
		CreatedBy:     createdByID,
		Message:       obj.GetMessage(),
		RestoredFrom:  restoreVer,
		Version:       int(vspec.Version),
		ParentVersion: int(vspec.ParentVersion),
		Data:          simplejson.NewFromAny(vspec.Spec),
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

// DashboardVersionSpec contains the necessary fields to represent a dashboard version.
type DashboardVersionSpec struct {
	UID           string
	Version       int64
	ParentVersion int64
	Spec          any
	MetaAccessor  utils.GrafanaMetaAccessor
}

// UnstructuredToDashboardVersionSpec converts a k8s unstructured object to a DashboardVersionSpec.
// It supports dashboard API versions v0alpha1 through v2beta1.
func UnstructuredToDashboardVersionSpec(obj *unstructured.Unstructured, dst *DashboardVersionSpec) error {
	if obj.GetAPIVersion() == dashboardv2alpha1.GroupVersion.String() ||
		obj.GetAPIVersion() == dashboardv2beta1.GroupVersion.String() {
		spec, ok := obj.Object["spec"]
		if !ok {
			return errors.New("error parsing dashboard from k8s response")
		}

		meta, err := utils.MetaAccessor(obj)
		if err != nil {
			return err
		}

		version := meta.GetGeneration()
		parentVersion := version - 1
		if parentVersion < 0 {
			parentVersion = 0
		}

		dst.UID = obj.GetName()
		dst.Version = version
		dst.ParentVersion = parentVersion
		dst.Spec = spec
		dst.MetaAccessor = meta

		return nil
	}

	// Otherwise we assume that we are dealing with a legacy dashboard API version (v0 / v1 / etc.)

	spec, ok := obj.Object["spec"].(map[string]any)
	if !ok {
		return errors.New("error parsing dashboard from k8s response")
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	uid := meta.GetName()
	spec["uid"] = uid

	dashVersion := meta.GetGeneration()
	parentVersion := dashVersion - 1
	if parentVersion < 0 {
		parentVersion = 0
	}
	if dashVersion > 0 {
		spec["version"] = dashVersion
	}

	dst.UID = uid
	dst.Version = dashVersion
	dst.ParentVersion = parentVersion
	dst.Spec = spec
	dst.MetaAccessor = meta

	return nil
}
