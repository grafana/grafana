package dashboards

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/legacyapi/internal/apis"
)

const (
	defaultAPIVersion  = "v0alpha1"
	anonymous          = "Anonymous"
	generalFolderTitle = "General"
	iamAudience        = "iam.grafana.app"
)

var apiVersionPattern = regexp.MustCompile(`^v[0-9]+[a-z0-9]*$`)

// APIClient gets resources from an app platform API server.
type APIClient interface {
	Get(ctx context.Context, path string, creds apis.Credentials) (*unstructured.Unstructured, error)
}

// GetHandler serves the legacy GET /api/dashboards/uid/{uid} endpoint.
//
// Dashboard and folder reads use the requester's credentials, so the API
// servers authorize them as they would a direct request. Creator and updater
// names come from the IAM API with the service's own token, because
// single-tenant Grafana shows them whatever the requester may read.
type GetHandler struct {
	Dashboards APIClient
	Folders    APIClient
	IAM        APIClient
	// TokenExchanger gets the service's token for IAM. Without one, every
	// creator and updater is Anonymous.
	TokenExchanger authn.TokenExchanger
}

func (h *GetHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	creds := apis.CredentialsFromRequest(r)
	if creds.AccessToken == "" || creds.IDToken == "" {
		writeMessage(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	requester, err := apis.ParseIDToken(ctx, creds.IDToken)
	if err != nil {
		writeMessage(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	ns := requester.Namespace

	obj, err := h.getDashboard(ctx, ns, r.PathValue("uid"), strings.TrimSpace(r.URL.Query().Get("apiVersion")), creds)
	if err != nil {
		switch apis.StatusCode(err) {
		case http.StatusUnauthorized:
			writeMessage(w, http.StatusUnauthorized, "Unauthorized")
		case http.StatusForbidden:
			writeAccessDenied(w, "dashboards:read")
		default:
			writeMessage(w, http.StatusNotFound, "Dashboard not found")
		}
		return
	}

	dash, err := FromConverted(obj)
	if err != nil {
		writeMessage(w, http.StatusNotFound, "Dashboard not found")
		return
	}
	// unified storage keeps the id out of the spec; the legacy API returns it
	if id, _ := dash.Data["id"].(string); id == "" {
		dash.Data["id"] = dash.ID
	}

	access := accessInfo(obj)
	names := h.names(ctx, ns, dash.CreatedBy, dash.UpdatedBy)

	meta := Meta{
		Slug:                   dash.Slug,
		Type:                   "db",
		CanStar:                requester.Type != types.TypeAnonymous,
		CanSave:                access.CanSave,
		CanEdit:                access.CanSave,
		CanAdmin:               access.CanAdmin,
		CanDelete:              access.CanDelete,
		Created:                dash.Created,
		Updated:                dash.Updated,
		UpdatedBy:              nameOrAnonymous(names[dash.UpdatedBy]),
		CreatedBy:              nameOrAnonymous(names[dash.CreatedBy]),
		Version:                dash.Version,
		APIVersion:             dash.APIVersion,
		HasACL:                 dash.HasACL,
		IsFolder:               dash.IsFolder,
		Url:                    dashboardURL(dash),
		FolderTitle:            generalFolderTitle,
		AnnotationsPermissions: access.AnnotationsPermissions,
	}

	if dash.FolderUID != "" {
		status, msg := h.addFolder(ctx, ns, dash.FolderUID, creds, &meta)
		if status != 0 {
			writeMessage(w, status, msg)
			return
		}
	}

	if objMeta, err := utils.MetaAccessor(obj); err == nil {
		if m, ok := objMeta.GetManagerProperties(); ok && m.Kind == utils.ManagerKindClassicFP { // nolint:staticcheck
			meta.Provisioned = !m.AllowsEdits
			if s, ok := objMeta.GetSourceProperties(); ok {
				meta.ProvisionedExternalId = s.Path
			}
		}
	}

	dash.Data["version"] = dash.Version

	writeJSON(w, http.StatusOK, DashboardWithMeta{Meta: meta, Dashboard: dash.Data})
}

// getDashboard reads the dashboard's /dto subresource the way single-tenant
// Grafana reads the dashboard: at the requested version if it can, otherwise
// at the default version, and at the stored version when conversion failed.
func (h *GetHandler) getDashboard(ctx context.Context, ns, uid, requested string, creds apis.Credentials) (*unstructured.Unstructured, error) {
	if apiVersionPattern.MatchString(requested) {
		if obj, err := h.getDTO(ctx, ns, uid, requested, creds); err == nil {
			return h.storedVersionIfConversionFailed(ctx, ns, uid, obj, creds)
		}
	}

	obj, err := h.getDTO(ctx, ns, uid, defaultAPIVersion, creds)
	if err != nil {
		return nil, err
	}
	return h.storedVersionIfConversionFailed(ctx, ns, uid, obj, creds)
}

func (h *GetHandler) storedVersionIfConversionFailed(ctx context.Context, ns, uid string, obj *unstructured.Unstructured, creds apis.Credentials) (*unstructured.Unstructured, error) {
	failed, _, _ := unstructured.NestedBool(obj.Object, "status", "conversion", "failed")
	stored, _, _ := unstructured.NestedString(obj.Object, "status", "conversion", "storedVersion")
	if !failed || !apiVersionPattern.MatchString(stored) {
		return obj, nil
	}
	return h.getDTO(ctx, ns, uid, stored, creds)
}

func (h *GetHandler) getDTO(ctx context.Context, ns, uid, version string, creds apis.Credentials) (*unstructured.Unstructured, error) {
	path := fmt.Sprintf("/apis/dashboard.grafana.app/%s/namespaces/%s/dashboards/%s/dto",
		version, url.PathEscape(ns), url.PathEscape(uid))
	return h.Dashboards.Get(ctx, path, creds)
}

// addFolder fills in the folder fields of meta. A non-zero status is the
// error response to send.
func (h *GetHandler) addFolder(ctx context.Context, ns, uid string, creds apis.Credentials, meta *Meta) (int, string) {
	meta.FolderUid = uid
	meta.FolderTitle = ""

	path := fmt.Sprintf("/apis/folder.grafana.app/v1beta1/namespaces/%s/folders/%s", url.PathEscape(ns), url.PathEscape(uid))
	obj, err := h.Folders.Get(ctx, path, creds)
	switch {
	case err == nil:
		title, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
		meta.FolderTitle = title
		if folderMeta, err := utils.MetaAccessor(obj); err == nil {
			meta.FolderId = folderMeta.GetDeprecatedInternalID() // nolint:staticcheck
		}
	case apis.StatusCode(err) == http.StatusNotFound:
		return http.StatusNotFound, "Folder not found"
	case apis.StatusCode(err) == http.StatusForbidden:
		// the dashboard is in a folder the user can't access, so return the dashboard without folder info
	default:
		return http.StatusInternalServerError, "Dashboard folder could not be read"
	}

	meta.FolderUrl = fmt.Sprintf("/dashboards/f/%s/%s", uid, slugify.Slugify(meta.FolderTitle))
	return 0, ""
}

// names resolves identities such as "user:abc" to the login or service
// account name single-tenant Grafana shows. It leaves out any it can't
// resolve.
func (h *GetHandler) names(ctx context.Context, ns string, identities ...string) map[string]string {
	out := map[string]string{}
	if h.TokenExchanger == nil {
		return out
	}

	var creds *apis.Credentials
	for _, identity := range identities {
		if _, done := out[identity]; done || identity == "" {
			continue
		}
		typ, uid, ok := strings.Cut(identity, ":")
		if !ok || uid == "" {
			continue
		}
		var resource, field string
		switch types.IdentityType(typ) {
		case types.TypeUser:
			resource, field = "users", "login"
		case types.TypeServiceAccount:
			resource, field = "serviceaccounts", "title"
		default:
			continue
		}

		if creds == nil {
			token, err := h.TokenExchanger.Exchange(ctx, authn.TokenExchangeRequest{Namespace: ns, Audiences: []string{iamAudience}})
			if err != nil {
				return out
			}
			creds = &apis.Credentials{AccessToken: token.Token}
		}

		path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/%s/%s", url.PathEscape(ns), resource, url.PathEscape(uid))
		obj, err := h.IAM.Get(ctx, path, *creds)
		if err != nil {
			continue
		}
		if name, _, _ := unstructured.NestedString(obj.Object, "spec", field); name != "" {
			out[identity] = name
		}
	}
	return out
}

// dashboardAccess is the "access" block of a /dto response.
type dashboardAccess struct {
	CanSave                bool                              `json:"canSave"`
	CanAdmin               bool                              `json:"canAdmin"`
	CanDelete              bool                              `json:"canDelete"`
	AnnotationsPermissions *dashboardv1.AnnotationPermission `json:"annotationsPermissions"`
}

func accessInfo(obj *unstructured.Unstructured) dashboardAccess {
	var access dashboardAccess
	if m, ok := obj.Object["access"].(map[string]any); ok {
		_ = runtime.DefaultUnstructuredConverter.FromUnstructured(m, &access)
	}
	if access.AnnotationsPermissions == nil {
		access.AnnotationsPermissions = &dashboardv1.AnnotationPermission{}
	}
	return access
}

func nameOrAnonymous(name string) string {
	if name == "" {
		return anonymous
	}
	return name
}

func dashboardURL(dash *Dashboard) string {
	if dash.IsFolder {
		return fmt.Sprintf("/dashboards/f/%s/%s", dash.UID, dash.Slug)
	}
	return fmt.Sprintf("/d/%s/%s", dash.UID, dash.Slug)
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeMessage(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

// writeAccessDenied writes the body single-tenant Grafana's access control
// middleware sends when a permission check fails.
func writeAccessDenied(w http.ResponseWriter, permission string) {
	writeJSON(w, http.StatusForbidden, map[string]string{
		"title":         "Access denied",
		"message":       "You'll need additional permissions to perform this action. Permissions needed: " + permission,
		"accessErrorId": accessErrorID(),
	})
}

func accessErrorID() string {
	n, err := rand.Int(rand.Reader, big.NewInt(1e10))
	if err != nil {
		return "ACE0000000000"
	}
	return fmt.Sprintf("ACE%010d", n.Int64())
}
