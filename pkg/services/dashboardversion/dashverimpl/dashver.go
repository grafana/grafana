package dashverimpl

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"go.opentelemetry.io/otel"
	"golang.org/x/sync/errgroup"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashboardclient "github.com/grafana/grafana/pkg/services/dashboards/service/client"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboardversion/dashverimpl")

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

	versionObj, err := s.getDashboardVersionThroughK8s(ctx, query.OrgID, query.DashboardUID, query.Version)
	if err != nil {
		return nil, err
	}

	return s.transformUnstructuredToLegacyDTO(ctx, versionObj)
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
func (s *Service) List(
	ctx context.Context, query *dashver.ListDashboardVersionsQuery,
) (*dashver.DashboardVersionResponse, error) {
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

	list, err := s.listDashboardVersionsThroughK8s(
		ctx,
		query.OrgID,
		query.DashboardUID,
		int64(query.Limit),
		query.ContinueToken,
	)
	if err != nil {
		return nil, err
	}

	dashboards, err := s.transformUnstructuredToLegacyDTOList(ctx, list.Items)
	if err != nil {
		return nil, err
	}

	return &dashver.DashboardVersionResponse{
		ContinueToken: list.GetContinue(),
		Versions:      dashboards,
	}, nil
}

// RestoreVersion restores a dashboard version.
func (s *Service) RestoreVersion(ctx context.Context, cmd *dashver.RestoreVersionCommand) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "Service.RestoreVersion")
	defer span.End()

	// Get dashboard UID if not provided
	if cmd.DashboardUID == "" {
		u, err := s.getDashUIDMaybeEmpty(ctx, cmd.DashboardID)
		if err != nil {
			s.log.Debug("error getting dashboard UID", "error", err)
			return nil, tracing.Error(span, err)
		}
		cmd.DashboardUID = u
	}

	if s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesDashboards) ||
		s.features.IsEnabledGlobally(featuremgmt.FlagDashboardNewLayouts) {
		s.log.Debug("restoring dashboard version through k8s")
		res, err := s.restoreVersionThroughK8s(ctx, cmd)
		if err != nil {
			s.log.Debug("error restoring dashboard version through k8s", "error", err)
			return nil, tracing.Error(span, err)
		}

		return res, nil
	}

	s.log.Debug("restoring dashboard version through legacy")
	res, err := s.restoreVersionLegacy(ctx, cmd)
	if err != nil {
		s.log.Debug("error restoring dashboard version through legacy", "error", err)
		return nil, tracing.Error(span, err)
	}

	return res, nil
}

func (s *Service) getDashboardVersionThroughK8s(
	ctx context.Context, orgID int64, dashboardUID string, version int64,
) (*unstructured.Unstructured, error) {
	// this is an unideal implementation - we have to list all versions and filter here,
	// since there currently is no way to query for the
	// generation id in unified storage, so we cannot query for the dashboard version directly,
	// and we cannot use search as history is not indexed.
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
				return &item, nil
			}
		}

		continueToken = out.GetContinue()
		if continueToken == "" || len(out.Items) == 0 {
			break
		}
	}

	return nil, dashboards.ErrDashboardNotFound
}

func (s *Service) listDashboardVersionsThroughK8s(
	ctx context.Context, orgID int64, dashboardUID string, limit int64, continueToken string,
) (*unstructured.UnstructuredList, error) {
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

	return out, nil
}

func (s *Service) restoreVersionThroughK8s(
	ctx context.Context, cmd *dashver.RestoreVersionCommand,
) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "Service.restoreVersionThroughK8s")
	defer span.End()

	// We must use separate gctx context here, because it will be canceled, once the group is done.
	// If we use the same ctx after the call to g.Wait, it will already be canceled at that point,
	// causing all subsequent context-using operations to immediately return with "context canceled" error.
	g, gctx := errgroup.WithContext(ctx)

	var current *unstructured.Unstructured
	g.Go(func() error {
		var err error
		current, err = s.k8sclient.Get(gctx, cmd.DashboardUID, cmd.Requester.GetOrgID(), v1.GetOptions{})
		if err != nil {
			s.log.Debug("error getting current dashboard", "error", err)
		}
		return err
	})

	var version *unstructured.Unstructured
	g.Go(func() error {
		var err error
		version, err = s.getDashboardVersionThroughK8s(gctx, cmd.Requester.GetOrgID(), cmd.DashboardUID, cmd.Version)
		if err != nil {
			s.log.Debug("error getting version", "error", err)
		}
		return err
	})

	if err := g.Wait(); err != nil {
		return nil, tracing.Error(span, err)
	}

	// Compare dashboard data using the new version-aware comparator
	identical, err := compareUnstructuredDashboards(version, current)
	if err != nil {
		s.log.Debug("error comparing dashboard versions", "error", err)
		return nil, tracing.Error(span, err)
	}
	if identical {
		return nil, dashboards.ErrDashboardRestoreIdenticalVersion
	}

	versionMeta, err := utils.MetaAccessor(version)
	if err != nil {
		s.log.Debug("error getting old version meta accessor", "error", err)
		return nil, tracing.Error(span, err)
	}
	spec, err := versionMeta.GetSpec()
	if err != nil {
		s.log.Debug("error getting old version spec", "error", err)
		return nil, tracing.Error(span, err)
	}

	currentMeta, err := utils.MetaAccessor(current)
	if err != nil {
		s.log.Debug("error getting current meta accessor", "error", err)
		return nil, tracing.Error(span, err)
	}
	currentMeta.SetMessage(dashboardRestoreMessage(int(versionMeta.GetGeneration())))
	if err := currentMeta.SetSpec(spec); err != nil {
		s.log.Debug("error setting current version spec", "error", err)
		return nil, tracing.Error(span, err)
	}

	updatedObj, err := s.k8sclient.Update(ctx, current, cmd.Requester.GetOrgID(), v1.UpdateOptions{})
	if err != nil {
		s.log.Debug("error updating dashboard to specified version", "error", err)
		return nil, tracing.Error(span, err)
	}

	res, err := s.dashSvc.UnstructuredToLegacyDashboard(ctx, updatedObj, cmd.Requester.GetOrgID())
	if err != nil {
		s.log.Debug("error converting dashboard to legacy dashboard", "error", err)
		return nil, tracing.Error(span, err)
	}

	return res, nil
}

func (s *Service) restoreVersionLegacy(
	ctx context.Context, cmd *dashver.RestoreVersionCommand,
) (*dashboards.Dashboard, error) {
	ctx, span := tracer.Start(ctx, "Service.restoreVersionLegacy")
	defer span.End()

	// We must use separate gctx context here, because it will be canceled, once the group is done.
	// If we use the same ctx after the call to g.Wait, it will already be canceled at that point,
	// causing all subsequent context-using operations to immediately return with "context canceled" error.
	g, gctx := errgroup.WithContext(ctx)

	var currentDash *dashboards.Dashboard
	g.Go(func() error {
		var err error
		currentDash, err = s.dashSvc.GetDashboard(gctx, &dashboards.GetDashboardQuery{
			UID:   cmd.DashboardUID,
			OrgID: cmd.Requester.GetOrgID(),
		})
		if err != nil {
			s.log.Debug("error getting dashboard", "error", err)
		}
		return err
	})

	var versionData *dashver.DashboardVersionDTO
	g.Go(func() error {
		versionObj, err := s.getDashboardVersionThroughK8s(gctx, cmd.Requester.GetOrgID(), cmd.DashboardUID, cmd.Version)
		if err != nil {
			s.log.Debug("error getting dashboard version", "error", err)
			return err
		}

		versionData, err = s.transformUnstructuredToLegacyDTO(gctx, versionObj)
		if err != nil {
			s.log.Debug("error transforming dashboard version to DTO", "error", err)
			return err
		}

		return nil
	})

	if err := g.Wait(); err != nil {
		return nil, tracing.Error(span, err)
	}

	if compareDashboardData(versionData.Data.MustMap(), currentDash.Data.MustMap(), true) {
		return nil, dashboards.ErrDashboardRestoreIdenticalVersion
	}

	userID, err := identity.UserIdentifier(cmd.Requester.GetID())
	if err != nil {
		s.log.Debug("error getting user identifier", "error", err)
		return nil, tracing.Error(span, err)
	}

	// This logic has been copied from the API handler unmodified for the most part.
	// There is some strange back-and-forth conversions between the two commands,
	// that should ideally be cleaned up.
	saveCmd := dashboards.SaveDashboardCommand{
		RestoredFrom: versionData.Version,
		OrgID:        cmd.Requester.GetOrgID(),
		UserID:       userID,
		Dashboard:    versionData.Data,
		FolderUID:    currentDash.FolderUID,
	}
	saveCmd.Dashboard.Set("version", currentDash.Version)
	saveCmd.Dashboard.Set("uid", currentDash.UID)
	dash := saveCmd.GetDashboardModel()
	dashItem := &dashboards.SaveDashboardDTO{
		User:      cmd.Requester,
		OrgID:     cmd.Requester.GetOrgID(),
		UpdatedAt: time.Now(),
		Message:   dashboardRestoreMessage(versionData.Version),
		Overwrite: false,
		Dashboard: dash,
	}

	res, err := s.dashSvc.SaveDashboard(ctx, dashItem, true)
	if err != nil {
		s.log.Debug("error saving dashboard", "error", err)
		return nil, tracing.Error(span, err)
	}

	return res, nil
}

func (s *Service) transformUnstructuredToLegacyDTO(
	ctx context.Context, item *unstructured.Unstructured,
) (*dashver.DashboardVersionDTO, error) {
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}

	users, err := s.k8sclient.GetUsersFromMeta(ctx, []string{obj.GetCreatedBy(), obj.GetUpdatedBy()})
	if err != nil {
		return nil, err
	}

	return unstructuredToLegacyDashboardVersionWithUsers(item, users)
}

func (s *Service) transformUnstructuredToLegacyDTOList(
	ctx context.Context, items []unstructured.Unstructured,
) ([]*dashver.DashboardVersionDTO, error) {
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
		version, err := unstructuredToLegacyDashboardVersionWithUsers(&item, users)
		if err != nil {
			return nil, err
		}
		versions[i] = version
	}

	return versions, nil
}

// getDashUIDMaybeEmpty is a helper function which takes a dashboardID and returns the UID.
// If the dashboard is not found, it will return an empty string.
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
	if obj.GetAPIVersion() == v2alpha1.GroupVersion.String() ||
		obj.GetAPIVersion() == v2beta1.GroupVersion.String() {
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

func unstructuredToLegacyDashboardVersionWithUsers(
	item *unstructured.Unstructured, users map[string]*user.User,
) (*dashver.DashboardVersionDTO, error) {
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

const restoreMsg = "Restored from version "

func dashboardRestoreMessage(version int) string {
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

// compareUnstructuredDashboards compares two dashboards in unstructured.Unstructured format.
func compareUnstructuredDashboards(dst, src *unstructured.Unstructured) (bool, error) {
	dstVersion := dst.GetAPIVersion()
	srcVersion := src.GetAPIVersion()

	// Both should have the same API version for comparison
	if dstVersion != srcVersion {
		return false, fmt.Errorf("cannot compare dashboards with different API versions: %s vs %s", dstVersion, srcVersion)
	}

	dstSpec, ok := dst.Object["spec"].(map[string]any)
	if !ok {
		return false, fmt.Errorf("failed to parse spec for the dashboard version")
	}

	srcSpec, ok := src.Object["spec"].(map[string]any)
	if !ok {
		return false, fmt.Errorf("failed to parse spec for the current dashboard")
	}

	cleanData := dstVersion == v0alpha1.APIVersion ||
		dstVersion == v1beta1.APIVersion

	return compareDashboardData(dstSpec, srcSpec, cleanData), nil
}

func compareDashboardData(versionData, dashData map[string]any, cleanData bool) bool {
	if cleanData {
		// these can be different but the actual data is the same
		delete(versionData, "version")
		delete(dashData, "version")
		delete(versionData, "id")
		delete(dashData, "id")
		delete(versionData, "uid")
		delete(dashData, "uid")
	}

	return reflect.DeepEqual(versionData, dashData)
}
