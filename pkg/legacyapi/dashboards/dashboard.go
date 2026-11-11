package dashboards

import (
	"errors"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard"
	dashboardv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/slugify"
)

const generalFolderUID = "general"

// Dashboard is a dashboard in the shape the legacy /api/dashboards endpoints
// use.
type Dashboard struct {
	ID         int64
	UID        string
	Title      string
	Slug       string
	FolderUID  string
	Version    int
	APIVersion string
	PluginID   string
	GnetID     int64
	IsFolder   bool
	HasACL     bool

	// CreatedBy and UpdatedBy are identities, such as "user:abc".
	CreatedBy string
	UpdatedBy string

	Created time.Time
	Updated time.Time
	Deleted time.Time

	Data map[string]any
}

// FromUnstructured converts a dashboard resource to its legacy shape. It
// writes uid and version into the resource's spec, and removes a legacy id.
func FromUnstructured(item *unstructured.Unstructured) (*Dashboard, error) {
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
	spec["version"] = dashVersion

	title, _, _ := unstructured.NestedString(spec, "title")
	folderUID := obj.GetFolder()
	if folderUID == generalFolderUID {
		folderUID = ""
	}
	out := Dashboard{
		ID:         obj.GetDeprecatedInternalID(), // nolint:staticcheck
		UID:        uid,
		Title:      title,
		Slug:       slugify.Slugify(title),
		FolderUID:  folderUID,
		Version:    int(dashVersion),
		APIVersion: strings.TrimPrefix(item.GetAPIVersion(), dashboardv0.GROUP+"/"),
		PluginID:   dashboard.GetPluginIDFromMeta(obj),
		CreatedBy:  obj.GetCreatedBy(),
		UpdatedBy:  obj.GetUpdatedBy(),
		Data:       spec,
	}

	out.Created = obj.GetCreationTimestamp().Time
	updated, err := obj.GetUpdatedTimestamp()
	if err == nil && updated != nil {
		// old apis return in local time, created is already doing that
		out.Updated = updated.Local()
	} else {
		out.Updated = out.Created
	}

	if deleted := obj.GetDeletionTimestamp(); deleted != nil {
		out.Deleted = deleted.Time
	}

	// any dashboards that have already been synced to unified storage will have the id in the spec
	// and not as a label. We will need to support this conversion until they have all been updated
	// to labels
	if id, ok := spec["id"].(int64); ok {
		out.ID = id
		delete(spec, "id")
	}
	if gnetID, ok := spec["gnet_id"].(int64); ok {
		out.GnetID = gnetID
	}
	if isFolder, ok := spec["is_folder"].(bool); ok {
		out.IsFolder = isFolder
	}
	if hasACL, ok := spec["has_acl"].(bool); ok {
		out.HasACL = hasACL
	}

	return &out, nil
}

// FromConverted is FromUnstructured for a dashboard read at a requested API
// version. When the API server could not convert the dashboard, it returns the
// dashboard as stored.
func FromConverted(item *unstructured.Unstructured) (*Dashboard, error) {
	out, err := FromUnstructured(item)
	if err != nil {
		return nil, err
	}

	gv, _ := schema.ParseGroupVersion(item.GetAPIVersion())
	if gv.Version != "" {
		out.APIVersion = gv.Version
	}

	conversion, ok, _ := unstructured.NestedMap(item.Object, "status", "conversion")
	if ok && conversion != nil {
		failed, _, _ := unstructured.NestedBool(conversion, "failed")
		if failed {
			out.APIVersion, _, _ = unstructured.NestedString(conversion, "storedVersion")
			if body, ok, _ := unstructured.NestedMap(conversion, "source"); ok {
				out.Data = body
			}
		}
	}

	return out, nil
}
