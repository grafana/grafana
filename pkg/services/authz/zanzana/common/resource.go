package common

import (
	"fmt"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

func NewResourceFromCheck(r *authzv1.CheckRequest) Resource {
	if info, ok := getTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return newResource(info.Type, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), info.Relations)
	}
	return newResource(TypeResource, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), RelationsResource)
}

func NewResourceFromBatchItem(i *authzextv1.BatchCheckItem) Resource {
	if info, ok := getTypeInfo(i.GetGroup(), i.GetResource()); ok {
		return newResource(info.Type, i.GetGroup(), i.GetResource(), i.GetName(), i.GetFolder(), info.Relations)
	}
	return newResource(TypeResource, i.GetGroup(), i.GetResource(), i.GetName(), i.GetFolder(), RelationsResource)
}

func NewResourceFromList(r *authzv1.ListRequest) Resource {
	if info, ok := getTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return newResource(info.Type, r.GetGroup(), r.GetResource(), "", "", info.Relations)

	}
	return newResource(TypeResource, r.GetGroup(), r.GetResource(), "", "", RelationsResource)
}

func newResource(typ string, group, resource, name, folder string, relations []string) Resource {
	return Resource{
		typ:       typ,
		group:     group,
		resource:  resource,
		name:      name,
		folder:    folder,
		relations: relations,
	}
}

type Resource struct {
	typ       string
	group     string
	resource  string
	name      string
	folder    string
	relations []string
}

func (r Resource) GroupResource() string {
	return FormatGroupResource(r.group, r.resource)
}

func (r Resource) GroupResourceIdent() string {
	return NewGroupResourceIdent(r.group, r.resource)
}

func (r Resource) ResourceIdent() string {
	if r.name == "" {
		return ""
	}

	if r.IsGeneric() {
		return fmt.Sprintf("%s:%s/%s", r.typ, r.GroupResource(), r.name)
	}

	return fmt.Sprintf("%s:%s", r.typ, r.name)
}

func (r Resource) FolderIdent() string {
	if r.folder == "" {
		return ""
	}

	return NewFolderIdent(r.folder)
}

func (r Resource) IsGeneric() bool {
	return r.typ == TypeResource
}

func (r Resource) Type() string {
	return r.typ
}

func (r Resource) Context() *structpb.Struct {
	if !r.IsGeneric() {
		return nil
	}

	return &structpb.Struct{
		Fields: map[string]*structpb.Value{
			"requested_group": structpb.NewStringValue(r.GroupResource()),
		},
	}
}

func (r Resource) IsValidRelation(relation string) bool {
	return isValidRelation(relation, r.relations)
}
