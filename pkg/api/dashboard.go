package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	claims "github.com/grafana/authlib/types"
	dashboardsV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardsV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	pref "github.com/grafana/grafana/pkg/services/preference"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

const (
	anonString = "Anonymous"
)

// swagger:route GET /dashboards/uid/{uid} dashboards getDashboardByUID
//
// Get dashboard by uid.
//
// Optional query parameter `apiVersion` selects the Kubernetes API version used to load the dashboard first
// (for example `v1beta1`). If that request fails, the default version is used instead. When omitted, only the default is used.
//
// Will return the dashboard given the dashboard unique identifier (uid).
//
// Use: /apis/dashboards.grafana.app/v1/namespaces/{ns}/dashboards/{uid}
//
// Deprecated: true
//
// Responses:
// 200: dashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 406: notAcceptableError
// 500: internalServerError
//
//nolint:gocyclo
func (hs *HTTPServer) GetDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]
	apiVersion := strings.TrimSpace(c.Req.URL.Query().Get("apiVersion"))
	dash, rsp := hs.getDashboardHelper(ctx, c.GetOrgID(), uid, apiVersion)
	if rsp != nil {
		return rsp
	}

	publicDashboardEnabled := false

	// If public dashboards is enabled and we have a public dashboard, update meta values
	if hs.Cfg.PublicDashboardsEnabled {
		publicDashboard, err := hs.PublicDashboardsApi.PublicDashboardService.FindByDashboardUid(ctx, c.GetOrgID(), dash.UID)
		if err != nil && !errors.Is(err, publicdashboards.ErrPublicDashboardNotFound) {
			return response.Error(http.StatusInternalServerError, "Error while retrieving public dashboards", err)
		}

		if publicDashboard != nil && (hs.License.FeatureEnabled(publicdashboards.FeaturePublicDashboardsEmailSharing) || publicDashboard.Share != publicdashboards.EmailShareType) {
			publicDashboardEnabled = publicDashboard.IsEnabled
		}
	}

	// When dash contains only keys id, uid that means dashboard data is not valid and json decode failed.
	if dash.Data != nil {
		isEmptyData := true
		for k := range dash.Data.MustMap() {
			if k != "id" && k != "uid" {
				isEmptyData = false
				break
			}
		}
		if isEmptyData {
			return response.Error(http.StatusInternalServerError, "Error while loading dashboard, dashboard data is invalid", nil)
		}

		// the dashboard id is no longer set in the spec for unified storage, set it here to keep api compatibility
		if dash.Data.Get("id").MustString() == "" {
			dash.Data.Set("id", dash.ID)
		}
	}

	dashScope := dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID)
	writeEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsWrite, dashScope)
	canSave, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, writeEvaluator)
	canEdit := canSave
	//nolint:staticcheck // ViewersCanEdit is deprecated but still used for backward compatibility
	if hs.Cfg.ViewersCanEdit {
		canEdit = true
	}
	deleteEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsDelete, dashScope)
	canDelete, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, deleteEvaluator)
	adminEvaluator := accesscontrol.EvalPermission(dashboards.ActionDashboardsPermissionsWrite, dashScope)
	canAdmin, _ := hs.AccessControl.Evaluate(ctx, c.SignedInUser, adminEvaluator)

	// Finding creator and last updater of the dashboard
	updater, creator := anonString, anonString
	if dash.UpdatedBy > 0 {
		updater = hs.getIdentityName(ctx, dash.OrgID, dash.UpdatedBy)
	}
	if dash.CreatedBy > 0 {
		creator = hs.getIdentityName(ctx, dash.OrgID, dash.CreatedBy)
	}

	annotationPermissions := &dashboardsV1.AnnotationPermission{}
	hs.getAnnotationPermissionsByScope(c, &annotationPermissions.Dashboard, dashboards.ScopeDashboardsProvider.GetResourceScopeUID(dash.UID))

	meta := dtos.DashboardMeta{
		Slug:                   dash.Slug,
		Type:                   dashboards.DashTypeDB,
		CanStar:                c.IsSignedIn,
		CanSave:                canSave,
		CanEdit:                canEdit,
		CanAdmin:               canAdmin,
		CanDelete:              canDelete,
		Created:                dash.Created,
		Updated:                dash.Updated,
		UpdatedBy:              updater,
		CreatedBy:              creator,
		Version:                dash.Version,
		APIVersion:             dash.APIVersion,
		HasACL:                 dash.HasACL,
		IsFolder:               dash.IsFolder,
		FolderId:               dash.FolderID, // nolint:staticcheck
		Url:                    dash.GetURL(),
		FolderTitle:            "General",
		AnnotationsPermissions: annotationPermissions,
		PublicDashboardEnabled: publicDashboardEnabled,
	}
	metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetDashboard).Inc()
	// lookup folder title & url
	if dash.FolderUID != "" {
		queryResult, err := hs.folderService.Get(ctx, &folder.GetFolderQuery{
			OrgID:        c.GetOrgID(),
			UID:          &dash.FolderUID,
			SignedInUser: c.SignedInUser,
		})
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return response.Error(http.StatusNotFound, "Folder not found", err)
		}
		if apierrors.IsForbidden(err) {
			// the dashboard is in a folder the user can't access, so return the dashboard without folder info
			err = nil
			queryResult = &folder.Folder{
				UID: dash.FolderUID,
			}
		}
		if err != nil {
			hs.log.Error("Failed to get dashboard folder", "error", err)
			return response.Error(http.StatusInternalServerError, "Dashboard folder could not be read", err)
		}

		meta.FolderUid = queryResult.UID
		meta.FolderTitle = queryResult.Title
		meta.FolderId = queryResult.ID // nolint:staticcheck
		queryResult = queryResult.WithURL()
		meta.FolderUrl = queryResult.URL
	} else if dash.FolderID > 0 { // nolint:staticcheck
		query := dashboards.GetDashboardQuery{ID: dash.FolderID, OrgID: c.SignedInUser.GetOrgID()} // nolint:staticcheck
		metrics.MFolderIDsAPICount.WithLabelValues(metrics.GetDashboard).Inc()
		queryResult, err := hs.DashboardService.GetDashboard(ctx, &query)
		if err != nil {
			if errors.Is(err, dashboards.ErrFolderNotFound) {
				return response.Error(http.StatusNotFound, "Folder not found", err)
			}
			return response.Error(http.StatusInternalServerError, "Dashboard folder could not be read", err)
		}
		meta.FolderUid = queryResult.UID
		meta.FolderTitle = queryResult.Title
		meta.FolderUrl = queryResult.GetURL()
	}

	provisioningData, err := hs.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardID(ctx, dash.ID)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Error while checking if dashboard is provisioned", err)
	}

	if provisioningData != nil {
		allowUIUpdate := hs.ProvisioningService.GetAllowUIUpdatesFromConfig(provisioningData.Name)
		if !allowUIUpdate {
			meta.Provisioned = true
		}

		meta.ProvisionedExternalId, err = filepath.Rel(
			hs.ProvisioningService.GetDashboardProvisionerResolvedPath(provisioningData.Name),
			provisioningData.ExternalID,
		)
		if err != nil {
			// Not sure when this could happen so not sure how to better handle this. Right now ProvisionedExternalId
			// is for better UX, showing in Save/Delete dialogs and so it won't break anything if it is empty.
			hs.log.Warn("Failed to create ProvisionedExternalId", "err", err)
		}
	}

	// make sure db version is in sync with json model version
	dash.Data.Set("version", dash.Version)

	dto := dtos.DashboardFullWithMeta{
		Dashboard: dash.Data,
		Meta:      meta,
	}

	return response.JSON(http.StatusOK, dto)
}

func (hs *HTTPServer) getAnnotationPermissionsByScope(c *contextmodel.ReqContext, actions *dashboardsV1.AnnotationActions, scope string) {
	ctx, span := tracer.Start(c.Req.Context(), "api.getAnnotationPermissionsByScope")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var err error

	evaluate := accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsCreate, scope)
	actions.CanAdd, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsCreate, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsDelete, scope)
	actions.CanDelete, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsDelete, "scope", scope)
	}

	evaluate = accesscontrol.EvalPermission(accesscontrol.ActionAnnotationsWrite, scope)
	actions.CanEdit, err = hs.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser, evaluate)
	if err != nil {
		hs.log.Warn("Failed to evaluate permission", "err", err, "action", accesscontrol.ActionAnnotationsWrite, "scope", scope)
	}
}

// getIdentityName returns name of either user or service account
func (hs *HTTPServer) getIdentityName(ctx context.Context, orgID, id int64) string {
	ctx, span := tracer.Start(ctx, "api.getIdentityName")
	defer span.End()

	// We use GetSignedInUser here instead of GetByID so both user and service accounts are resolved.
	ident, err := hs.userService.GetSignedInUser(ctx, &user.GetSignedInUserQuery{
		UserID: id,
		OrgID:  orgID,
	})
	if err != nil {
		return anonString
	}

	if ident.IsIdentityType(claims.TypeServiceAccount) {
		return ident.GetName()
	}
	return ident.GetLogin()
}

func (hs *HTTPServer) getDashboardHelper(ctx context.Context, orgID int64, uid string, k8sGetAPIVersion string) (*dashboards.Dashboard, response.Response) {
	ctx, span := hs.tracer.Start(ctx, "api.getDashboardHelper")
	defer span.End()

	queryResult, err := hs.DashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{
		UID:              uid,
		OrgID:            orgID,
		K8sGetAPIVersion: k8sGetAPIVersion,
	})
	if err != nil {
		return nil, response.Error(http.StatusNotFound, "Dashboard not found", err)
	}

	return queryResult, nil
}

// swagger:route DELETE /dashboards/uid/{uid} dashboards deleteDashboardByUID
//
// Delete dashboard by uid.
//
// Will delete the dashboard given the specified unique identifier (uid).
//
// Use: /apis/dashboards.grafana.app/v1/namespaces/{ns}/dashboards/{uid}
//
// Deprecated: true
//
// Responses:
// 200: deleteDashboardResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteDashboardByUID(c *contextmodel.ReqContext) response.Response {
	return hs.deleteDashboard(c)
}

func (hs *HTTPServer) deleteDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.deleteDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	uid := web.Params(c.Req)[":uid"]

	var rsp response.Response
	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.GetOrgID(), uid, "")
	if rsp != nil {
		return rsp
	}
	if dash.IsFolder {
		return response.Error(http.StatusBadRequest, "Use folders endpoint for deleting folders.", nil)
	}

	err := hs.DashboardService.DeleteDashboard(c.Req.Context(), dash.ID, dash.UID, c.GetOrgID())
	if err != nil {
		return dashboardErrResponse(err, "Failed to delete dashboard")
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"title":   dash.Title,
		"message": fmt.Sprintf("Dashboard %s deleted", dash.Title),
		"uid":     dash.UID,
	})
}

// swagger:route POST /dashboards/db dashboards postDashboard
//
// Create / Update dashboard
//
// Creates a new dashboard or updates an existing dashboard.
// Note: This endpoint is not intended for creating folders, use `POST /api/folders` for that.
//
// Use: /apis/dashboards.grafana.app/v1/namespaces/{ns}/dashboards
//
// Deprecated: true
//
// Responses:
// 200: postDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 412: preconditionFailedError
// 422: unprocessableEntityError
// 500: internalServerError
func (hs *HTTPServer) PostDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.PostDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	cmd := dashboards.SaveDashboardCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	return hs.postDashboard(c, cmd)
}

func (hs *HTTPServer) postDashboard(c *contextmodel.ReqContext, cmd dashboards.SaveDashboardCommand) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.postDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	if cmd.IsFolder {
		return response.Error(http.StatusBadRequest, "Use folders endpoint for saving folders.", nil)
	}

	spec, err := cmd.Dashboard.Map()
	if err != nil {
		return response.Error(http.StatusBadRequest, "Failed to read dashboard", err)
	}

	// Check for v2 schema elements without a k8s style wrapper
	if dashboards.LooksLikeV2Spec(spec) {
		return response.Error(http.StatusBadRequest, dashboards.LooksLikeV2SpecMessage+
			" OR it should include a object wrapper with an explicit 'apiVersion' and move the body into a 'spec' element", nil)
	}

	obj := &unstructured.Unstructured{Object: map[string]interface{}{
		"spec": spec,
	}}

	// Items with metadata, spec, etc
	if dashboards.LooksLikeK8sResource(spec) {
		obj.Object = spec
		apiVersion := obj.GetAPIVersion()
		switch {
		case strings.HasPrefix(apiVersion, dashboardsV1.GROUP):
			if _, ok, err := unstructured.NestedInt64(spec, "id"); ok || err != nil {
				return response.Error(http.StatusBadRequest, "The k8s style dashboard must not include an id on the root element", nil)
			}
			if _, ok := spec["spec"]; !ok {
				return response.Error(http.StatusBadRequest, "The k8s style dashboard must include the dashboard contents in the spec property", nil)
			}
			uid, ok, _ := unstructured.NestedString(spec, "uid")
			if ok {
				delete(obj.Object, "uid")
				obj.SetName(uid) // overwrite the incoming name -- this might happen from TF providers
			}
			hs.log.Warn("DEPRECATION WARNING: Accepting k8s style dashboard in legacy /api/dashboards/db.  Please use the /apis/dashboard.grafana.app/ API to manage this resource", "dashboard", obj.GetName())

		case apiVersion == "":
			return response.Error(http.StatusBadRequest, "Dashboard appears to be a k8s style resource, but is missing an explicit apiVersion.", nil)
		default:
			return response.Error(http.StatusBadRequest, "The dashboard payload references a non dashboard apiVersion.  This should be sent to the requested api directly", nil)
		}
	} else {
		// Default legacy POSTs to v0alpha1: matches the prior DashboardService.SaveDashboard
		// behavior. v0 lets the dashboard apiserver mutate hook strip uid/version/id without
		// running the v1 schema migrations, so legacy callers' panel content is preserved.
		obj.SetAPIVersion(dashboardsV0.APIVERSION)
	}
	return hs.saveDashboardViaK8s(c, cmd, obj)
}

func (hs *HTTPServer) saveDashboardViaK8s(c *contextmodel.ReqContext, cmd dashboards.SaveDashboardCommand, obj *unstructured.Unstructured) response.Response {
	gv, err := schema.ParseGroupVersion(obj.GetAPIVersion())
	if err != nil {
		return response.Error(http.StatusBadRequest, "Dashboard appears to be a full k8s style resource.  Please use the /apis/dashboard.grafana.app/ API to manage this resource", err)
	}

	title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
	if title == "" {
		return response.Error(http.StatusBadRequest, "Dashboard spec is missing required title property", nil)
	}

	ctx := c.Req.Context()
	namespace := hs.namespacer(c.GetOrgID())
	tmp, err := dynamic.NewForConfig(hs.clientConfigProvider.GetDirectRestConfig(c))
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create k8s client", err)
	}
	client := tmp.Resource(gv.WithResource(dashboardsV1.DASHBOARD_RESOURCE)).Namespace(namespace)

	// /api/dashboards/db lets clients place identity (uid, id) and version
	// inside the spec; lift them onto k8s metadata, then strip the originals
	// so the apistore mutate hooks see a clean spec.
	specUID, _, _ := unstructured.NestedString(obj.Object, "spec", "uid")
	internalID, err := nestedInternalID(obj.Object)
	if err != nil {
		return response.Error(http.StatusBadRequest, err.Error(), err)
	}
	specVersion, hasSpecVersion, err := nestedSpecVersion(obj.Object)
	if err != nil {
		return response.Error(http.StatusBadRequest, err.Error(), err)
	}
	unstructured.RemoveNestedField(obj.Object, "spec", "uid")
	unstructured.RemoveNestedField(obj.Object, "spec", "id")
	unstructured.RemoveNestedField(obj.Object, "spec", "version")

	// Reset the wrapper to a clean state the apistore will accept.
	obj.SetKind("Dashboard")
	obj.SetNamespace(namespace)
	obj.SetAnnotations(map[string]string{})
	obj.SetLabels(map[string]string{})
	delete(obj.Object, "status")
	delete(obj.Object, "access") // present if the caller copied a /dto object

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read grafana metadata", err)
	}
	meta.SetUID("")
	meta.SetResourceVersion("")
	meta.SetFinalizers(nil)
	meta.SetManagedFields(nil)
	meta.SetFolder(cmd.FolderUID)
	meta.SetMessage(cmd.Message)

	name := obj.GetName()
	if name == "" && specUID != "" {
		name = specUID
		meta.SetName(name)
	}

	// Resolve any legacy numeric id onto the k8s name. Errors here pin the
	// legacy contract: 404 on unknown id, 500 on ambiguous id, 400 when the
	// supplied uid refers to a different dashboard than the id does.
	var old *unstructured.Unstructured
	if internalID > 0 {
		var rsp response.Response
		if name, old, rsp = hs.resolveLegacyInternalID(ctx, client, internalID, name); rsp != nil {
			return rsp
		}
		meta.SetName(name)
		meta.SetDeprecatedInternalID(internalID) // nolint:staticcheck
	}

	// Pull the existing object if we don't already have it; isCreate flips
	// once we know the name doesn't exist.
	if name != "" && old == nil {
		old, err = client.Get(ctx, name, metav1.GetOptions{})
		if k8serrors.IsNotFound(err) {
			old = nil
		} else if err != nil {
			// 403 / etc. must reach the client unchanged.
			return apierrors.ToDashboardErrorResponse(ctx, hs.pluginStore, err)
		}
	}
	isCreate := old == nil
	if isCreate && name == "" && obj.GetGenerateName() == "" {
		obj.SetGenerateName("a")
	}

	if !isCreate {
		oldMeta, err := utils.MetaAccessor(old)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to read grafana metadata", err)
		}
		// Check if provisioning allows edits.
		// NOTE this would be handled by the storage layer, however the error is different so
		// we are checking here to make the existing contracts on /api hold.
		if m, ok := oldMeta.GetManagerProperties(); ok && !m.AllowsEdits {
			return response.Error(http.StatusBadRequest, dashboards.ErrDashboardCannotSaveProvisionedDashboard.Error(), nil)
		}

		// Without overwrite, accept the update only when the caller supplied
		// the current version (we return meta.GetGeneration() as "version").
		if !cmd.Overwrite {
			if !hasSpecVersion || specVersion != oldMeta.GetGeneration() {
				return response.Error(http.StatusConflict,
					"Dashboard already exists. Use overwrite flag to update.", nil)
			}
		}
	}

	validation := metav1.FieldValidationWarn
	if strings.HasPrefix(gv.Version, "v0") {
		validation = metav1.FieldValidationIgnore // v0 accepts anything
	}
	var dash *unstructured.Unstructured
	if isCreate {
		// Seed default RBAC permissions for the creator. The apistore strips
		// this annotation before persisting and invokes its
		// DefaultPermissionSetter hook after the resource is created.
		meta.SetAnnotation(utils.AnnoKeyGrantPermissions, utils.AnnoGrantPermissionsDefault)
		dash, err = client.Create(ctx, obj, metav1.CreateOptions{FieldValidation: validation})
	} else {
		dash, err = client.Update(ctx, obj, metav1.UpdateOptions{FieldValidation: validation})
	}
	if err != nil {
		return apierrors.ToDashboardErrorResponse(ctx, hs.pluginStore, err)
	}

	dashMeta, err := utils.MetaAccessor(dash)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed get meta accessor", err)
	}

	title, _, _ = unstructured.NestedString(dash.Object, "spec", "title")
	slug := slugify.Slugify(title)
	return response.JSON(http.StatusOK, util.DynMap{
		"status":    "success",
		"slug":      slug,
		"version":   dashMeta.GetGeneration(),
		"id":        dashMeta.GetDeprecatedInternalID(), //nolint:staticcheck
		"uid":       dashMeta.GetName(),
		"url":       dashboards.GetDashboardFolderURL(false, dashMeta.GetName(), slug),
		"folderUid": dashMeta.GetFolder(),
	})
}

// resolveLegacyInternalID maps a legacy numeric id onto the k8s resource name
// and (when fetched along the way) the existing object. A non-nil
// response.Response means we couldn't resolve it and the caller should return
// it directly: 404 if no dashboard has that id and no uid was supplied, 500 if
// the id is ambiguous, 400 if the supplied uid refers to a different dashboard.
func (hs *HTTPServer) resolveLegacyInternalID(ctx context.Context, client dynamic.ResourceInterface, internalID int64, name string) (string, *unstructured.Unstructured, response.Response) {
	ref, err := hs.DashboardService.GetDashboardUIDByID(ctx, &dashboards.GetDashboardRefByIDQuery{ID: internalID})
	switch {
	case errors.Is(err, dashboards.ErrDashboardNotFound):
		if name == "" {
			return "", nil, response.Error(http.StatusNotFound, dashboards.ErrDashboardNotFound.Error(), nil)
		}
		// uid was provided; treat as a regular create with a legacy id label.
		return name, nil, nil
	case err != nil:
		// "unexpected number of dashboards" + any other unexpected error.
		return "", nil, response.Error(http.StatusInternalServerError, err.Error(), err)
	}
	if name == "" {
		obj, gerr := client.Get(ctx, ref.UID, metav1.GetOptions{})
		if gerr != nil && !k8serrors.IsNotFound(gerr) {
			return "", nil, response.Error(http.StatusInternalServerError, "Failed to read existing dashboard", gerr)
		}
		return ref.UID, obj, nil
	}
	if name == ref.UID {
		return name, nil, nil
	}
	// id and uid disagree; allow the new uid only if it isn't already taken.
	if _, gerr := client.Get(ctx, name, metav1.GetOptions{}); gerr == nil {
		return "", nil, response.Error(http.StatusBadRequest, dashboards.ErrDashboardWithSameUIDExists.Error(), nil)
	} else if !k8serrors.IsNotFound(gerr) {
		return "", nil, response.Error(http.StatusInternalServerError, "Failed to read existing dashboard", gerr)
	}
	return name, nil, nil
}

func nestedInternalID(obj map[string]interface{}) (int64, error) {
	val, found, err := unstructured.NestedFieldNoCopy(obj, "spec", "id")
	if !found || err != nil || val == nil {
		return 0, nil
	}
	i, ok := val.(int64)
	if ok {
		return i, nil
	}
	n, ok := val.(json.Number)
	if ok {
		return n.Int64()
	}
	return 0, fmt.Errorf("unsupported ID type: %T", val)
}

// nestedSpecVersion reads spec.version as int64. The legacy /api/dashboards/db
// payload encodes version as a JSON number; simplejson parses it via UseNumber
// so we usually see json.Number, but tolerate the common numeric types too.
// A missing field returns (0, false, nil); a malformed field returns an error
// so callers can surface a 400 instead of letting it fall through as a 409.
func nestedSpecVersion(obj map[string]interface{}) (int64, bool, error) {
	val, found, err := unstructured.NestedFieldNoCopy(obj, "spec", "version")
	if err != nil {
		return 0, false, fmt.Errorf("spec.version is invalid: %w", err)
	}
	if !found || val == nil {
		return 0, false, nil
	}
	switch v := val.(type) {
	case int64:
		return v, true, nil
	case int:
		return int64(v), true, nil
	case float64:
		return int64(v), true, nil
	case json.Number:
		i, err := v.Int64()
		if err != nil {
			return 0, false, fmt.Errorf("spec.version is not an integer: %w", err)
		}
		return i, true, nil
	}
	return 0, false, fmt.Errorf("spec.version has unsupported type %T", val)
}

// swagger:route GET /dashboards/home dashboards getHomeDashboard
//
// NOTE: the home dashboard is configured in preferences.  This API will be removed in G13
//
// Deprecated: true
//
// Responses:
// 200: getHomeDashboardResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetHomeDashboard(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetHomeDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var userID int64
	if id, err := identity.UserIdentifier(c.GetID()); err == nil {
		userID = id
	}

	prefsQuery := pref.GetPreferenceWithDefaultsQuery{OrgID: c.GetOrgID(), UserID: userID, Teams: c.GetTeams()}
	homePage := hs.Cfg.HomePage

	preference, err := hs.preferenceService.GetWithDefaults(c.Req.Context(), &prefsQuery)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to get preferences", err)
	}

	if preference.HomeDashboardUID == "" && len(homePage) > 0 {
		homePageRedirect := dtos.DashboardRedirect{RedirectUri: homePage}
		return response.JSON(http.StatusOK, &homePageRedirect)
	}

	if preference.HomeDashboardUID != "" {
		slugQueryResult, err := hs.DashboardService.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{UID: preference.HomeDashboardUID, OrgID: c.GetOrgID()})
		if err == nil {
			url := dashboards.GetDashboardURL(preference.HomeDashboardUID, slugQueryResult.Slug)
			dashRedirect := dtos.DashboardRedirect{RedirectUri: url}
			return response.JSON(http.StatusOK, &dashRedirect)
		}
		hs.log.Warn("Failed to get slug from database", "err", err)
	}

	filePath := hs.Cfg.DefaultHomeDashboardPath
	if filePath == "" {
		filePath = filepath.Join(hs.Cfg.StaticRootPath, "dashboards/home.json")
	}

	// It's safe to ignore gosec warning G304 since the variable part of the file path comes from a configuration
	// variable
	// nolint:gosec
	file, err := os.Open(filePath)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to load home dashboard", err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			hs.log.Warn("Failed to close dashboard file", "path", filePath, "err", err)
		}
	}()

	doc := simplejson.New()
	jsonParser := json.NewDecoder(file)
	if err := jsonParser.Decode(doc); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to load home dashboard", err)
	}

	// If the configured home dashboard file is a Kubernetes-style Grafana
	// dashboard resource, return it to the client as that style, with the
	// injected access shape so that frontend can use the same translator it
	// already consumes (/dto format)
	if isK8sDashboardResource(doc) {
		// Getting-started panel injection still runs against the spec body so
		// v0/v1 resources behave the same as classic home dashboards if the
		// existing guards in addGettingStartedPanelToHomeDashboard allow it.
		if spec, ok := doc.CheckGet("spec"); ok {
			hs.addGettingStartedPanelToHomeDashboard(c, spec)
		}
		doc.Set("access", map[string]any{
			"canSave":   false,
			"canShare":  false,
			"canStar":   false,
			"canEdit":   false,
			"canDelete": false,
			"canAdmin":  false,
		})
		return response.JSON(http.StatusOK, doc)
	}

	dash := dtos.DashboardFullWithMeta{}
	dash.Meta.CanEdit = c.HasRole(org.RoleEditor)
	dash.Meta.FolderTitle = "General"
	dash.Dashboard = doc

	hs.addGettingStartedPanelToHomeDashboard(c, dash.Dashboard)

	return response.JSON(http.StatusOK, &dash)
}

// isK8sDashboardResource reports whether the given JSON document is a
// Kubernetes-style Grafana dashboard resource (apiVersion in the
// dashboard.grafana.app group, kind=Dashboard, and an object-valued spec).
func isK8sDashboardResource(doc *simplejson.Json) bool {
	if doc == nil {
		return false
	}

	apiVersion, _ := doc.Get("apiVersion").String()
	kind, _ := doc.Get("kind").String()
	spec, hasSpec := doc.CheckGet("spec")
	if apiVersion == "" || kind != "Dashboard" || !hasSpec {
		return false
	}
	if _, err := spec.Map(); err != nil {
		return false
	}

	group, version, ok := strings.Cut(apiVersion, "/")
	if !ok || group != dashboardsV1.APIGroup || version == "" {
		return false
	}
	return true
}

func (hs *HTTPServer) addGettingStartedPanelToHomeDashboard(c *contextmodel.ReqContext, dash *simplejson.Json) {
	ctx, span := tracer.Start(c.Req.Context(), "api.addGettingStartedPanelToHomeDashboard")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	// We only add this getting started panel for Admins who have not dismissed it,
	// and if a custom default home dashboard hasn't been configured
	if !c.HasUserRole(org.RoleAdmin) ||
		c.HasHelpFlag(user.HelpFlagGettingStartedPanelDismissed) ||
		hs.Cfg.DefaultHomeDashboardPath != "" {
		return
	}

	panels := dash.Get("panels").MustArray()

	newpanel := simplejson.NewFromAny(map[string]any{
		"type": "gettingstarted",
		"id":   123123,
		"gridPos": map[string]any{
			"x": 0,
			"y": 3,
			"w": 24,
			"h": 9,
		},
	})

	panels = append(panels, newpanel)
	dash.Set("panels", panels)
}

// swagger:route GET /dashboards/uid/{uid}/versions dashboards versions getDashboardVersionsByUID
//
// Gets all existing versions for the dashboard using UID.
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardVersions(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardVersions")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)
	var err error
	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		return response.Error(http.StatusBadRequest, "uid is required", nil)
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.GetOrgID(), dashUID, "")
	if rsp != nil {
		return rsp
	}

	query := dashver.ListDashboardVersionsQuery{
		OrgID:         c.GetOrgID(),
		DashboardID:   dash.ID,
		DashboardUID:  dash.UID,
		Limit:         c.QueryInt("limit"),
		Start:         c.QueryInt("start"),
		ContinueToken: c.Query("continueToken"),
	}

	resp, err := hs.dashboardVersionService.List(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusNotFound, fmt.Sprintf("No versions found for dashboardId %d", dash.ID), err)
	}

	loginMem := make(map[int64]string, len(resp.Versions))
	res := make([]dashver.DashboardVersionMeta, 0, len(resp.Versions))
	for _, version := range resp.Versions {
		msg := version.Message
		if version.RestoredFrom == version.Version {
			msg = "Initial save (created by migration)"
		}

		if version.RestoredFrom > 0 {
			msg = fmt.Sprintf("Restored from version %d", version.RestoredFrom)
		}

		if version.ParentVersion == 0 {
			msg = "Initial save"
		}

		creator := anonString
		if version.CreatedBy > 0 {
			login, found := loginMem[version.CreatedBy]
			if found {
				creator = login
			} else {
				creator = hs.getIdentityName(c.Req.Context(), c.GetOrgID(), version.CreatedBy)
				if creator != anonString {
					loginMem[version.CreatedBy] = creator
				}
			}
		}

		res = append(res, dashver.DashboardVersionMeta{
			ID:            version.ID,
			DashboardID:   version.DashboardID,
			DashboardUID:  dash.UID,
			Data:          version.Data,
			ParentVersion: version.ParentVersion,
			RestoredFrom:  version.RestoredFrom,
			Version:       version.Version,
			Created:       version.Created,
			Message:       msg,
			CreatedBy:     creator,
		})
	}

	return response.JSON(http.StatusOK, dashver.DashboardVersionResponseMeta{
		Versions:      res,
		ContinueToken: resp.ContinueToken,
	})
}

// swagger:route GET /dashboards/uid/{uid}/versions/{DashboardVersionID} dashboards versions getDashboardVersionByUID
//
// Get a specific dashboard version using UID.
//
// Deprecated: true
//
// Responses:
// 200: dashboardVersionResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardVersion(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardVersion")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	var err error
	dashUID := web.Params(c.Req)[":uid"]

	var dash *dashboards.Dashboard
	if dashUID == "" {
		return response.Error(http.StatusBadRequest, "uid is required", nil)
	}

	dash, rsp := hs.getDashboardHelper(c.Req.Context(), c.GetOrgID(), dashUID, "")
	if rsp != nil {
		return rsp
	}

	version, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Err(err)
	}
	query := dashver.GetDashboardVersionQuery{
		OrgID:        c.GetOrgID(),
		DashboardID:  dash.ID,
		DashboardUID: dash.UID,
		Version:      version,
	}

	res, err := hs.dashboardVersionService.Get(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, fmt.Sprintf("Dashboard version %d not found for dashboardId %d", query.Version, dash.ID), err)
	}

	creator := anonString
	if res.CreatedBy > 0 {
		creator = hs.getIdentityName(c.Req.Context(), dash.OrgID, res.CreatedBy)
	}

	dashVersionMeta := &dashver.DashboardVersionMeta{
		ID:            res.ID,
		DashboardID:   res.DashboardID,
		DashboardUID:  dash.UID,
		Data:          res.Data,
		ParentVersion: res.ParentVersion,
		RestoredFrom:  res.RestoredFrom,
		Version:       res.Version,
		Created:       res.Created,
		Message:       res.Message,
		CreatedBy:     creator,
	}

	return response.JSON(http.StatusOK, dashVersionMeta)
}

// swagger:route POST /dashboards/uid/{uid}/restore dashboards versions restoreDashboardVersionByUID
//
// Restore a dashboard to a given dashboard version using UID.
// This API will be removed when /apis/dashboards.grafana.app/v1 is released.
// You can restore a dashboard by reading it from history, then creating it again.
//
// Deprecated: true
//
// Responses:
// 200: postDashboardResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) RestoreDashboardVersion(c *contextmodel.ReqContext) response.Response {
	ctx, span := tracer.Start(c.Req.Context(), "api.RestoreDashboardVersion")
	defer span.End()

	c.Req = c.Req.WithContext(ctx)

	var apiCmd dtos.RestoreDashboardVersionCommand
	if err := web.Bind(c.Req, &apiCmd); err != nil {
		hs.log.Error("error restoring dashboard version: invalid request", "error", err)
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	var (
		dashID int64
		err    error
	)

	dashUID := web.Params(c.Req)[":uid"]
	if dashUID == "" {
		dashID, err = strconv.ParseInt(web.Params(c.Req)[":dashboardId"], 10, 64)
		if err != nil {
			hs.log.Error("error restoring dashboard version: invalid dashboardId", "error", err)
			return response.Error(http.StatusBadRequest, "dashboardId is invalid", err)
		}
	}

	res, err := hs.dashboardVersionService.RestoreVersion(ctx, &dashver.RestoreVersionCommand{
		Requester:    c.SignedInUser,
		DashboardUID: dashUID,
		DashboardID:  dashID,
		Version:      apiCmd.Version,
	})
	if err != nil {
		hs.log.Error("error restoring dashboard version: service call failed", "error", err)
		return dashboardErrResponse(err, "Failed to restore dashboard version")
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"status":    "success",
		"slug":      res.Slug,
		"version":   res.Version,
		"id":        res.ID,
		"uid":       res.UID,
		"url":       res.GetURL(),
		"folderUid": res.FolderUID,
	})
}

// swagger:route GET /dashboards/tags dashboards getDashboardTags
//
// Get all dashboards tags of an organization.
//
// Deprecated: true
//
// Responses:
// 200: getDashboardsTagsResponse
// 401: unauthorisedError
// 500: internalServerError
func (hs *HTTPServer) GetDashboardTags(c *contextmodel.ReqContext) {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardTags")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	query := dashboards.GetDashboardTagsQuery{OrgID: c.GetOrgID()}
	queryResult, err := hs.DashboardService.GetDashboardTags(c.Req.Context(), &query)
	if err != nil {
		c.JsonApiErr(500, "Failed to get tags from database", err)
		return
	}

	c.JSON(http.StatusOK, queryResult)
}

// GetDashboardUIDs converts internal ids to UIDs
func (hs *HTTPServer) GetDashboardUIDs(c *contextmodel.ReqContext) {
	ctx, span := tracer.Start(c.Req.Context(), "api.GetDashboardUIDs")
	defer span.End()
	c.Req = c.Req.WithContext(ctx)

	ids := strings.Split(web.Params(c.Req)[":ids"], ",")
	uids := make([]string, 0, len(ids))

	q := &dashboards.GetDashboardRefByIDQuery{}
	for _, idstr := range ids {
		id, err := strconv.ParseInt(idstr, 10, 64)
		if err != nil {
			continue
		}
		q.ID = id
		qResult, err := hs.DashboardService.GetDashboardUIDByID(c.Req.Context(), q)
		if err != nil {
			continue
		}
		uids = append(uids, qResult.UID)
	}
	c.JSON(http.StatusOK, uids)
}

func dashboardErrResponse(err error, fallbackMessage string) response.Response {
	var dashboardErr dashboardaccess.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, dashboardErr.Error(), err)
	}

	var statusErr *k8serrors.StatusError
	if errors.As(err, &statusErr) {
		return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
	}

	return response.Error(http.StatusInternalServerError, fallbackMessage, err)
}

// swagger:parameters restoreDashboardVersionByID
type RestoreDashboardVersionByIDParams struct {
	// in:body
	// required:true
	Body dtos.RestoreDashboardVersionCommand
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersionsByID
type GetDashboardVersionsByIDParams struct {
	// in:path
	DashboardID int64
}

// swagger:parameters getDashboardVersionsByUID
type GetDashboardVersionsByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters restoreDashboardVersionByUID
type RestoreDashboardVersionByUIDParams struct {
	// in:body
	// required:true
	Body dtos.RestoreDashboardVersionCommand
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardVersionByID
type GetDashboardVersionByIDParams struct {
	// in:path
	DashboardID int64
	// in:path
	DashboardVersionID int64
}

// swagger:parameters getDashboardVersionByUID
type GetDashboardVersionByUIDParams struct {
	// in:path
	DashboardVersionID int64
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters getDashboardVersions getDashboardVersionsByUID
type GetDashboardVersionsParams struct {
	// Maximum number of results to return
	// in:query
	// required:false
	// default:0
	Limit int `json:"limit"`

	// Version to start from when returning queries
	// in:query
	// required:false
	// default:0
	Start int `json:"start"`
}

// swagger:parameters getDashboardByUID
type GetDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters deleteDashboardByUID
type DeleteDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters hardDeleteDashboardByUID
type HardDeleteDashboardByUIDParams struct {
	// in:path
	// required:true
	UID string `json:"uid"`
}

// swagger:parameters postDashboard
type PostDashboardParams struct {
	// in:body
	// required:true
	Body dashboards.SaveDashboardCommand
}

// swagger:parameters calculateDashboardDiff
type CalcDashboardDiffParams struct {
	// in:body
	// required:true
	Body struct {
		Base dtos.CalculateDiffTarget `json:"base" binding:"Required"`
		New  dtos.CalculateDiffTarget `json:"new" binding:"Required"`
		// The type of diff to return
		// Description:
		// * `basic`
		// * `json`
		// Enum: basic,json
		DiffType string `json:"diffType" binding:"Required"`
	}
}

// swagger:response dashboardResponse
type DashboardResponse struct {
	// The response message
	// in: body
	Body dtos.DashboardFullWithMeta `json:"body"`
}

// swagger:response deleteDashboardResponse
type DeleteDashboardResponse struct {
	// The response message
	// in: body
	Body struct {
		// UID Identifier of the deleted dashboard.
		// required: true
		// example: 65
		UID string `json:"uid"`

		// Title Title of the deleted dashboard.
		// required: true
		// example: My Dashboard
		Title string `json:"title"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response postDashboardResponse
type PostDashboardResponse struct {
	// in: body
	Body struct {
		// Status status of the response.
		// required: true
		// example: success
		Status string `json:"status"`

		// Slug The slug of the dashboard.
		// required: true
		// example: my-dashboard
		Slug string `json:"title"`

		// Version The version of the dashboard.
		// required: true
		// example: 2
		Verion int64 `json:"version"`

		// ID The unique identifier (id) of the created/updated dashboard.
		// required: true
		// example: 1
		ID int64 `json:"id"`

		// UID The unique identifier (uid) of the created/updated dashboard.
		// required: true
		// example: nHz3SXiiz
		UID string `json:"uid"`

		// URL The relative URL for accessing the created/updated dashboard.
		// required: true
		// example: /d/nHz3SXiiz/my-dashboard
		URL string `json:"url"`

		// FolderUID The unique identifier (uid) of the folder the dashboard belongs to.
		// required: false
		FolderUID string `json:"folderUid"`
	} `json:"body"`
}

// swagger:response calculateDashboardDiffResponse
type CalculateDashboardDiffResponse struct {
	// in: body
	Body []byte `json:"body"`
}

// swagger:response getHomeDashboardResponse
type GetHomeDashboardResponse struct {
	// in: body
	Body GetHomeDashboardResponseBody `json:"body"`
}

// swagger:response getDashboardsTagsResponse
type DashboardsTagsResponse struct {
	// in: body
	Body []*dashboards.DashboardTagCloudItem `json:"body"`
}

// Get home dashboard response.
// swagger:model GetHomeDashboardResponse
type GetHomeDashboardResponseBody struct {
	// swagger:allOf
	// required: false
	dtos.DashboardFullWithMeta

	// swagger:allOf
	// required: false
	dtos.DashboardRedirect
}

// swagger:response dashboardVersionsResponse
type DashboardVersionsResponse struct {
	// in: body
	Body *dashver.DashboardVersionResponseMeta `json:"body"`
}

// swagger:response dashboardVersionResponse
type DashboardVersionResponse struct {
	// in: body
	Body *dashver.DashboardVersionMeta `json:"body"`
}

// swagger:parameters restoreDeletedDashboardByUID
type RestoreDeletedDashboardByUID struct {
	// in:path
	// required:true
	UID string `json:"uid"`

	// in:body
	// required:true
	Body dashboards.RestoreDeletedDashboardCommand
}
