package common

import (
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"google.golang.org/protobuf/types/known/structpb"

	folders "github.com/grafana/grafana/pkg/apis/folder/v1"
	iamalpha1 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
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
		iamalpha1.TeamResourceInfo.GroupResource().Group,
		iamalpha1.TeamResourceInfo.GroupResource().Resource,
		"",
	): {Type: "team", Relations: RelationsTyped},
	FormatGroupResource(
		iamalpha1.UserResourceInfo.GroupResource().Group,
		iamalpha1.UserResourceInfo.GroupResource().Resource,
		"",
	): {Type: "user", Relations: RelationsTyped},
	FormatGroupResource(
		iamalpha1.ServiceAccountResourceInfo.GroupResource().Group,
		iamalpha1.ServiceAccountResourceInfo.GroupResource().Resource,
		"",
	): {Type: "service-account", Relations: RelationsTyped},
}

func getTypeInfo(group, resource string) (typeInfo, bool) {
	info, ok := typedResources[FormatGroupResource(group, resource, "")]
	return info, ok
}

func NewResourceInfoFromCheck(r *authzv1.CheckRequest) ResourceInfo {
	typ, relations := getTypeAndRelations(r.GetGroup(), r.GetResource())
	return newResource(
		typ,
		r.GetGroup(),
		r.GetResource(),
		r.GetName(),
		r.GetFolder(),
		r.GetSubresource(),
		relations,
	)
}

func NewResourceInfoFromBatchItem(i *authzextv1.BatchCheckItem) ResourceInfo {
	typ, relations := getTypeAndRelations(i.GetGroup(), i.GetResource())
	return newResource(
		typ,
		i.GetGroup(),
		i.GetResource(),
		i.GetName(),
		i.GetFolder(),
		i.GetSubresource(),
		relations,
	)
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

func (r ResourceInfo) ResourceIdent() string {
	if r.name == "" {
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
