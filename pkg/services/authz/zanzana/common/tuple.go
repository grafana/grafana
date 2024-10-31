package common

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

const (
	resourceType       = "resource"
	namespaceType      = "namespace"
	folderResourceType = "folder_resource"
)

func NewTypedIdent(typ string, name string) string {
	return fmt.Sprintf("%s:%s", typ, name)
}

func NewResourceIdent(group, resource, name string) string {
	return fmt.Sprintf("%s:%s/%s", resourceType, FormatGroupResource(group, resource), name)
}

func NewFolderResourceIdent(group, resource, folder string) string {
	return fmt.Sprintf("%s:%s/%s", folderResourceType, FormatGroupResource(group, resource), folder)
}

func NewNamespaceResourceIdent(group, resource string) string {
	return fmt.Sprintf("%s:%s", namespaceType, FormatGroupResource(group, resource))
}

func FormatGroupResource(group, resource string) string {
	return fmt.Sprintf("%s/%s", group, resource)
}

func NewResourceTuple(subject, relation, group, resource, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewResourceIdent(group, resource, name),
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"resource_group": structpb.NewStringValue(FormatGroupResource(group, resource)),
				},
			},
		},
	}
}

func NewFolderResourceTuple(subject, relation, group, resource, folder string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewFolderResourceIdent(group, resource, folder),
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"resource_group": structpb.NewStringValue(FormatGroupResource(group, resource)),
				},
			},
		},
	}
}

func NewNamespaceResourceTuple(subject, relation, group, resource string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewNamespaceResourceIdent(group, resource),
	}
}

func NewFolderTuple(subject, relation, name string) *openfgav1.TupleKey {
	return NewTypedTuple("folder2", subject, relation, name)
}

func NewTypedTuple(typ, subject, relation, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewTypedIdent(typ, name),
	}
}
