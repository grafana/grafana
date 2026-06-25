package common

import (
	"google.golang.org/protobuf/types/known/structpb"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	foldermodel "github.com/grafana/grafana/pkg/services/folder"
)

type typeInfo struct {
	Type      string
	Relations []string
}

var typedResources = map[string]typeInfo{
	FormatGroupResource(
		folders.FolderResourceInfo.GroupResource().Group,
		folders.FolderResourceInfo.GroupResource().Resource,
		"",
	): {Type: "folder", Relations: RelationsTyped},
	FormatGroupResource(
		iamv0alpha1.TeamResourceInfo.GroupResource().Group,
		iamv0alpha1.TeamResourceInfo.GroupResource().Resource,
		"",
	): {Type: "team", Relations: RelationsTyped},
	FormatGroupResource(
		iamv0alpha1.UserResourceInfo.GroupResource().Group,
		iamv0alpha1.UserResourceInfo.GroupResource().Resource,
		"",
	): {Type: "user", Relations: RelationsTyped},
	FormatGroupResource(
		iamv0alpha1.ServiceAccountResourceInfo.GroupResource().Group,
		iamv0alpha1.ServiceAccountResourceInfo.GroupResource().Resource,
		"",
	): {Type: "service-account", Relations: RelationsTyped},
}

func getTypeInfo(group, resource string) (typeInfo, bool) {
	info, ok := typedResources[FormatGroupResource(group, resource, "")]
	return info, ok
}

func NewResourceInfoFromCheck(r *authzv1.CheckRequest) ResourceInfo {
	typ, relations := getTypeAndRelations(r.GetGroup(), r.GetResource())

	resource := newResource(
		typ,
		r.GetGroup(),
		r.GetResource(),
		r.GetName(),
		r.GetFolder(),
		r.GetSubresource(),
		relations,
	)

	if r.GetVerb() == utils.VerbCreate {
		resource.normalizeForCreate()
	}

	return resource
}

func NewResourceInfoFromList(r *authzv1.ListRequest) ResourceInfo {
	typ, relations := getTypeAndRelations(r.GetGroup(), r.GetResource())
	return newResource(
		typ,
		r.GetGroup(),
		r.GetResource(),
		"",
		"",
		r.GetSubresource(),
		relations,
	)
}

func NewResourceInfoFromBatchCheckItem(item *authzv1.BatchCheckItem) ResourceInfo {
	typ, relations := getTypeAndRelations(item.GetGroup(), item.GetResource())

	resource := newResource(
		typ,
		item.GetGroup(),
		item.GetResource(),
		item.GetName(),
		item.GetFolder(),
		item.GetSubresource(),
		relations,
	)

	if item.GetVerb() == utils.VerbCreate {
		resource.normalizeForCreate()
	}

	return resource
}

// normalizeForCreate adjusts a resource for a create-verb permission check,
// where Zanzana models the root as the synthetic "general" folder. The root
// parent may arrive as any sentinel ("", "general", or "root") depending on
// whether the apistore has stamped it.
func (r *ResourceInfo) normalizeForCreate() {
	if r.IsFolderResource() && r.name == "" {
		// Create checks use an empty Name. For a subfolder, Folder is the
		// parent and permission is evaluated on it (can_create), not "general".
		if !foldermodel.IsRootFolderUID(r.folder) {
			r.name = r.folder
			r.folder = ""
		} else {
			r.name = accesscontrol.GeneralFolderUID
		}
	} else if r.HasFolderSupport() && foldermodel.IsRootFolderUID(r.folder) {
		r.folder = accesscontrol.GeneralFolderUID
		// Mark this as a real create target so FolderIdent surfaces the general
		// folder rather than treating it as "no parent" (see rootForCreate).
		r.rootForCreate = true
	}
}

func getTypeAndRelations(group, resource string) (string, []string) {
	if info, ok := getTypeInfo(group, resource); ok {
		return info.Type, info.Relations
	}
	return TypeResource, RelationsResource
}

func newResource(
	typ, group, resource, name, folder, subresource string, relations []string,
) ResourceInfo {
	return ResourceInfo{
		typ:         typ,
		group:       group,
		resource:    resource,
		name:        name,
		folder:      folder,
		subresource: subresource,
		relations:   relations,
	}
}

type ResourceInfo struct {
	typ         string
	group       string
	resource    string
	name        string
	folder      string
	subresource string
	relations   []string
	// rootForCreate marks a create-at-root check, where the general folder is a
	// real target. It distinguishes that from a stored resource that merely
	// carries "general" as its parent, which must not inherit folder permissions.
	rootForCreate bool
}

func (r ResourceInfo) GroupResource() string {
	return FormatGroupResource(r.group, r.resource, r.subresource)
}

func (r ResourceInfo) GroupResourceIdent() string {
	return NewGroupResourceIdent(r.group, r.resource, r.subresource)
}

func (r ResourceInfo) ResourceIdent() string {
	// Treat "*" the same as "". Wildcard access ("can access all resources of this type")
	// is handled at the group-resource level.
	if r.name == "" || r.name == "*" {
		return ""
	}

	if r.IsGeneric() {
		return NewResourceIdent(r.group, r.resource, r.subresource, r.name)
	}

	return NewTypedIdent(r.typ, r.name)
}

func (r ResourceInfo) FolderIdent() string {
	if r.folder == "" {
		return ""
	}
	// A stored resource parented at the root now carries the "general" sentinel
	// instead of "". That means "no parent folder", so it must yield an empty
	// ident — otherwise permissions on the synthetic general folder would leak
	// to every root-parented resource. The exception is a create-at-root check
	// (rootForCreate), where the general folder is a real target.
	if foldermodel.IsRootFolderUID(r.folder) && !r.rootForCreate {
		return ""
	}

	return NewFolderIdent(r.folder)
}

func (r ResourceInfo) IsGeneric() bool {
	return r.typ == TypeResource
}

func (r ResourceInfo) Type() string {
	return r.typ
}

func (r ResourceInfo) Context() *structpb.Struct {
	return &structpb.Struct{
		Fields: map[string]*structpb.Value{
			"requested_group": structpb.NewStringValue(r.GroupResource()),
			"subresource":     structpb.NewStringValue(r.GroupResource()),
		},
	}
}

func (r ResourceInfo) IsValidRelation(relation string) bool {
	return isValidRelation(relation, r.relations)
}

func (r ResourceInfo) HasSubresource() bool {
	return r.subresource != ""
}

var resourcesWithFolderSupport = map[string]bool{
	dashboardV1.DashboardResourceInfo.GroupResource().Group: true,
}

func (r ResourceInfo) HasFolderSupport() bool {
	return resourcesWithFolderSupport[r.group]
}

func (r ResourceInfo) IsFolderResource() bool {
	return r.group == folders.FolderResourceInfo.GroupResource().Group
}
