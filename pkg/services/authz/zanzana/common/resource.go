package common

import (
	"fmt"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

func NewResourceFromCheck(r *authzv1.CheckRequest) Resource {
	typ := TypeResource
	if info, ok := GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		typ = info.Type
	}

	return newResource(typ, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder())
}

func NewResourceFromBatchItem(i *authzextv1.BatchCheckItem) Resource {
	typ := TypeResource
	if info, ok := GetTypeInfo(i.GetGroup(), i.GetResource()); ok {
		typ = info.Type
	}

	return newResource(typ, i.GetGroup(), i.GetResource(), i.GetName(), i.GetFolder())
}

func NewResourceFromList(r *authzextv1.ListRequest) Resource {
	typ := TypeResource
	if info, ok := GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		typ = info.Type
	}

	return newResource(typ, r.GetGroup(), r.GetResource(), "", "")
}

func newResource(typ string, group, resource, name, folder string) Resource {
	return Resource{
		Typ:      typ,
		Group:    group,
		Resource: resource,
		Name:     name,
		Folder:   folder,
	}
}

type Resource struct {
	Typ      string
	Group    string
	Resource string
	Name     string
	Folder   string
}

func (r Resource) GroupResource() string {
	return FormatGroupResource(r.Group, r.Resource)
}

func (r Resource) GroupResourceIdent() string {
	return NewGroupResourceIdent(r.Group, r.Resource)
}

func (r Resource) ResourceIdent() string {
	if r.Name == "" {
		return ""
	}

	if r.Typ == TypeResource {
		return fmt.Sprintf("%s:%s/%s", r.Typ, r.GroupResource(), r.Name)
	}

	return fmt.Sprintf("%s:%s", r.Typ, r.Name)
}

func (r Resource) FolderIdent() string {
	if r.Folder == "" {
		return ""
	}

	return NewFolderIdent(r.Folder)
}

func (r Resource) Context() *structpb.Struct {
	return &structpb.Struct{
		Fields: map[string]*structpb.Value{
			"requested_group": structpb.NewStringValue(r.GroupResource()),
		},
	}
}
