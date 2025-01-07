package common

import (
	"google.golang.org/protobuf/types/known/structpb"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	folderalpha1 "github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

type typeInfo struct {
	Type      string
	Relations []string
}

var typedResources = map[string]typeInfo{
	FormatGroupResource(
		folderalpha1.FolderResourceInfo.GroupResource().Group,
		folderalpha1.FolderResourceInfo.GroupResource().Resource,
		"",
	): {Type: "folder", Relations: RelationsFolder},
}

func getTypeInfo(group, resource string) (typeInfo, bool) {
	info, ok := typedResources[FormatGroupResource(group, resource, "")]
	return info, ok
}

func NewResourceInfoFromCheck(r *authzv1.CheckRequest) ResourceInfo {
	if info, ok := getTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return newResource(info.Type, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), r.GetSubresource(), info.Relations)
	}
	return newResource(TypeResource, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), r.GetSubresource(), RelationsResource)
}

func NewResourceInfoFromBatchItem(i *authzextv1.BatchCheckItem) ResourceInfo {
	if info, ok := getTypeInfo(i.GetGroup(), i.GetResource()); ok {
		return newResource(info.Type, i.GetGroup(), i.GetResource(), i.GetName(), i.GetFolder(), i.GetSubresource(), info.Relations)
	}
	return newResource(TypeResource, i.GetGroup(), i.GetResource(), i.GetName(), i.GetFolder(), i.GetSubresource(), RelationsResource)
}

func NewResourceInfoFromList(r *authzv1.ListRequest) ResourceInfo {
	if info, ok := getTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return newResource(info.Type, r.GetGroup(), r.GetResource(), "", "", r.GetSubresource(), info.Relations)
	}
	return newResource(TypeResource, r.GetGroup(), r.GetResource(), "", "", r.GetSubresource(), RelationsResource)
}

func newResource(typ string, group, resource, name, folder, subresource string, relations []string) ResourceInfo {
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
	if !r.IsGeneric() {
		return nil
	}

	return &structpb.Struct{
		Fields: map[string]*structpb.Value{
			"requested_group": structpb.NewStringValue(r.GroupResource()),
		},
	}
}

func (r ResourceInfo) IsValidRelation(relation string) bool {
	return isValidRelation(relation, r.relations)
}
