package common

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/zanzana/proto/v1"
)

const (
	TypeResource  = "resource"
	TypeFolder    = "folder"
	TypeNamespace = "namespace"
)

func FolderResourceRelation(relation string) string {
	return fmt.Sprintf("%s_%s", TypeResource, relation)
}

func NewTypedIdent(typ string, name string) string {
	return fmt.Sprintf("%s:%s", typ, name)
}

func NewResourceIdent(group, resource, name string) string {
	return fmt.Sprintf("%s:%s/%s", TypeResource, FormatGroupResource(group, resource), name)
}

func NewFolderIdent(name string) string {
	return fmt.Sprintf("%s:%s", TypeFolder, name)
}

func NewNamespaceResourceIdent(group, resource string) string {
	return fmt.Sprintf("%s:%s", TypeNamespace, FormatGroupResource(group, resource))
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
					"group_resource": structpb.NewStringValue(FormatGroupResource(group, resource)),
				},
			},
		},
	}
}

func NewFolderResourceTuple(subject, relation, group, resource, folder string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: FolderResourceRelation(relation),
		Object:   NewFolderIdent(folder),
		Condition: &openfgav1.RelationshipCondition{
			Name: "folder_group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resources": structpb.NewListValue(&structpb.ListValue{
						Values: []*structpb.Value{structpb.NewStringValue(FormatGroupResource(group, resource))},
					}),
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

func NewFolderParentTuple(folder, parent string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   NewFolderIdent(folder),
		Relation: "parent",
		User:     NewFolderIdent(parent),
	}
}

func NewFolderTuple(subject, relation, name string) *openfgav1.TupleKey {
	return NewTypedTuple(TypeFolder, subject, relation, name)
}

func NewTypedTuple(typ, subject, relation, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewTypedIdent(typ, name),
	}
}

func ToAuthzExtTupleKey(t *openfgav1.TupleKey) *authzextv1.TupleKey {
	tupleKey := &authzextv1.TupleKey{
		User:     t.GetUser(),
		Relation: t.GetRelation(),
		Object:   t.GetObject(),
	}

	if t.GetCondition() != nil {
		tupleKey.Condition = &authzextv1.RelationshipCondition{
			Name:    t.GetCondition().GetName(),
			Context: t.GetCondition().GetContext(),
		}
	}

	return tupleKey
}

func ToAuthzExtTupleKeys(tuples []*openfgav1.TupleKey) []*authzextv1.TupleKey {
	result := make([]*authzextv1.TupleKey, 0, len(tuples))
	for _, t := range tuples {
		result = append(result, ToAuthzExtTupleKey(t))
	}
	return result
}

func ToAuthzExtTupleKeyWithoutCondition(t *openfgav1.TupleKeyWithoutCondition) *authzextv1.TupleKeyWithoutCondition {
	return &authzextv1.TupleKeyWithoutCondition{
		User:     t.GetUser(),
		Relation: t.GetRelation(),
		Object:   t.GetObject(),
	}
}

func ToAuthzExtTupleKeysWithoutCondition(tuples []*openfgav1.TupleKeyWithoutCondition) []*authzextv1.TupleKeyWithoutCondition {
	result := make([]*authzextv1.TupleKeyWithoutCondition, 0, len(tuples))
	for _, t := range tuples {
		result = append(result, ToAuthzExtTupleKeyWithoutCondition(t))
	}
	return result
}

func ToOpenFGATupleKey(t *authzextv1.TupleKey) *openfgav1.TupleKey {
	tupleKey := &openfgav1.TupleKey{
		User:     t.GetUser(),
		Relation: t.GetRelation(),
		Object:   t.GetObject(),
	}

	if t.GetCondition() != nil {
		tupleKey.Condition = &openfgav1.RelationshipCondition{
			Name:    t.GetCondition().GetName(),
			Context: t.GetCondition().GetContext(),
		}
	}

	return tupleKey
}

func ToOpenFGATupleKeyWithoutCondition(t *authzextv1.TupleKeyWithoutCondition) *openfgav1.TupleKeyWithoutCondition {
	return &openfgav1.TupleKeyWithoutCondition{
		User:     t.GetUser(),
		Relation: t.GetRelation(),
		Object:   t.GetObject(),
	}
}

func ToOpenFGATuple(t *authzextv1.Tuple) *openfgav1.Tuple {
	return &openfgav1.Tuple{
		Key:       ToOpenFGATupleKey(t.GetKey()),
		Timestamp: t.GetTimestamp(),
	}
}

func ToOpenFGATuples(tuples []*authzextv1.Tuple) []*openfgav1.Tuple {
	result := make([]*openfgav1.Tuple, 0, len(tuples))
	for _, t := range tuples {
		result = append(result, ToOpenFGATuple(t))
	}
	return result
}
