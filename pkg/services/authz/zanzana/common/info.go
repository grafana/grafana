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

	// Special case for creating folders and resources in the root folder
	if r.GetVerb() == utils.VerbCreate {
		if resource.IsFolderResource() && resource.name == "" {
			// Create checks use an empty Name. For a subfolder, Folder is the parent;
			// permission must be evaluated on the parent folder (can_create), not on
			// "general". A root-parented folder may carry any root sentinel ("",
			// "general", or "root") depending on whether the apistore has stamped it.
			if !foldermodel.IsRootFolderUID(resource.folder) {
				resource.name = resource.folder
				resource.folder = ""
			} else {
				resource.name = accesscontrol.GeneralFolderUID
			}
		} else if resource.HasFolderSupport() && foldermodel.IsRootFolderUID(resource.folder) {
			// Zanzana's permission graph models the root as the synthetic
			// "general" folder, regardless of which sentinel ("", "general",
			// or "root") the apistore stamped on the request. Normalize so
			// the create check resolves against that one entity.
			resource.folder = accesscontrol.GeneralFolderUID
			// The general folder is a real Zanzana entity for the purpose of
			// "can I create here?" — mark this so FolderIdent surfaces it.
			// This also covers the case where the apistore has already mutated
			// the folder annotation to "general" (root-parented resources) by
			// the time we check create permission.
			resource.rootForCreate = true
		}

		return resource
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

	// Special case for creating folders and resources in the root folder
	if item.GetVerb() == utils.VerbCreate {
		if resource.IsFolderResource() && resource.name == "" {
			// See NewResourceInfoFromCheck for the rationale.
			if !foldermodel.IsRootFolderUID(resource.folder) {
				resource.name = resource.folder
				resource.folder = ""
			} else {
				resource.name = accesscontrol.GeneralFolderUID
			}
		} else if resource.HasFolderSupport() && foldermodel.IsRootFolderUID(resource.folder) {
			resource.folder = accesscontrol.GeneralFolderUID
			// See NewResourceInfoFromCheck for the rationale.
			resource.rootForCreate = true
		}

		return resource
	}

	return resource
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
	// rootForCreate is true when folder was explicitly normalized to the
	// synthetic "general" sentinel by the create-verb special case (i.e. the
	// caller is asking "may I create here?" at the root). It distinguishes
	// that intent from a stored resource whose folder annotation just
	// happens to be "general" — for the latter, the "general" folder is not
	// a real parent and must not contribute folder-inherited permissions.
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
	// The unified apistore stamps an explicit root sentinel
	// (folder.GeneralFolderUID) on root-parented resources where the
	// annotation used to be empty. For stored resources this is a "no parent
	// folder" marker and must yield the empty ident here — otherwise
	// folder-inherited permissions on the synthetic general folder would
	// leak access to every root-parented resource.
	// The one exception is the create-verb special case
	// (rootForCreate=true) where the general folder is a real Zanzana
	// entity used to answer "may I create at root?".
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
