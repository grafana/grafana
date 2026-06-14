package common

import (
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
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
			// permission must be evaluated on the parent folder (can_create), not on "general".
			if resource.folder != "" {
				resource.name = resource.folder
				resource.folder = ""
			} else {
				resource.name = accesscontrol.GeneralFolderUID
			}
		} else if resource.HasFolderSupport() && resource.folder == "" {
			resource.folder = accesscontrol.GeneralFolderUID
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
			if resource.folder != "" {
				resource.name = resource.folder
				resource.folder = ""
			} else {
				resource.name = accesscontrol.GeneralFolderUID
			}
		} else if resource.HasFolderSupport() && resource.folder == "" {
			resource.folder = accesscontrol.GeneralFolderUID
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
}

func (r ResourceInfo) GroupResource() string {
	return FormatGroupResource(r.group, r.resource, r.subresource)
}

func (r ResourceInfo) GroupResourceIdent() string {
	return NewGroupResourceIdent(r.group, r.resource, r.subresource)
}

// WildcardGroupResourceIdents returns the group_resource objects to check at the
// wildcard tier, allow-if-any. Most resources yield one object; a per-plugin datasource
// group also yields the canonical datasource.grafana.app object, where `datasources:*`
// grants live (instances are per-plugin, but that wildcard grant is plugin-agnostic).
func (r ResourceInfo) WildcardGroupResourceIdents() []string {
	perPlugin := NewGroupResourceIdent(r.group, r.resource, r.subresource)

	canonical := canonicalDatasourceGroup(r.group)
	if canonical == r.group {
		return []string{perPlugin}
	}

	return []string{perPlugin, NewGroupResourceIdent(canonical, r.resource, r.subresource)}
}

const (
	datasourceGroupSuffix    = ".datasource.grafana.app"
	datasourceCanonicalGroup = "datasource.grafana.app"
)

// canonicalDatasourceGroup maps a per-plugin datasource API group
// (<plugin>.datasource.grafana.app) to the canonical datasource.grafana.app group.
// Anything else (including the *.datasource.grafana.app key and nested groups) is unchanged.
func canonicalDatasourceGroup(group string) string {
	prefix, ok := strings.CutSuffix(group, datasourceGroupSuffix)
	if !ok || prefix == "" || strings.Contains(prefix, ".") || strings.HasPrefix(prefix, "*") {
		return group
	}
	return datasourceCanonicalGroup
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
