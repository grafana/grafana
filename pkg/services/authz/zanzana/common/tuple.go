package common

import (
	"fmt"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardalpha1 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const ClusterNamespace = "cluster"

const (
	TypeUser           string = "user"
	TypeServiceAccount string = "service-account"
	TypeRenderService  string = "render"
	TypeAnonymous      string = "anonymous"
	TypeTeam           string = "team"
	TypeRole           string = "role"
)

const (
	TypeFolder       string = "folder"
	TypeResource     string = "resource"
	TypeGroupResouce string = "group_resource"
)

const (
	RelationTeamMember string = "member"
	RelationTeamAdmin  string = "admin"
	RelationParent     string = "parent"
	RelationAssignee   string = "assignee"

	RelationSetView  string = "view"
	RelationSetEdit  string = "edit"
	RelationSetAdmin string = "admin"

	RelationGet    string = "get"
	RelationUpdate string = "update"
	RelationCreate string = "create"
	RelationDelete string = "delete"

	RelationFolderResourceSetView  string = "resource_" + RelationSetView
	RelationFolderResourceSetEdit  string = "resource_" + RelationSetEdit
	RelationFolderResourceSetAdmin string = "resource_" + RelationSetAdmin

	RelationFolderResourceGet    string = "resource_" + RelationGet
	RelationFolderResourceUpdate string = "resource_" + RelationUpdate
	RelationFolderResourceCreate string = "resource_" + RelationCreate
	RelationFolderResourceDelete string = "resource_" + RelationDelete
)

// RelationsGroupResource are relations that can be added on type "group_resource".
var RelationsGroupResource = []string{
	RelationGet,
	RelationUpdate,
	RelationCreate,
	RelationDelete,
}

// RelationsResource are relations that can be added on type "resource".
var RelationsResource = []string{
	RelationGet,
	RelationUpdate,
	RelationDelete,
}

// RelationsFolderResource are relations that can be added on type "folder" for child resources.
var RelationsFolderResource = []string{
	RelationFolderResourceGet,
	RelationFolderResourceUpdate,
	RelationFolderResourceCreate,
	RelationFolderResourceDelete,
}

// RelationsFolder are relations that can be added on type "folder".
var RelationsFolder = append(
	RelationsFolderResource,
	RelationGet,
	RelationUpdate,
	RelationCreate,
	RelationDelete,
)

// VerbMapping is mapping a k8s verb to a zanzana relation.
var VerbMapping = map[string]string{
	utils.VerbGet:              RelationGet,
	utils.VerbList:             RelationGet,
	utils.VerbWatch:            RelationGet,
	utils.VerbCreate:           RelationCreate,
	utils.VerbUpdate:           RelationUpdate,
	utils.VerbPatch:            RelationUpdate,
	utils.VerbDelete:           RelationDelete,
	utils.VerbDeleteCollection: RelationDelete,
}

// RelationToVerbMapping is mapping a zanzana relation to k8s verb.
var RelationToVerbMapping = map[string]string{
	RelationGet:    utils.VerbGet,
	RelationCreate: utils.VerbCreate,
	RelationUpdate: utils.VerbUpdate,
	RelationDelete: utils.VerbDelete,
}

func IsGroupResourceRelation(relation string) bool {
	return isValidRelation(relation, RelationsGroupResource)
}

func IsFolderResourceRelation(relation string) bool {
	return isValidRelation(relation, RelationsFolderResource)
}

func isValidRelation(relation string, valid []string) bool {
	for _, r := range valid {
		if r == relation {
			return true
		}
	}
	return false
}

func FolderResourceRelation(relation string) string {
	return fmt.Sprintf("%s_%s", TypeResource, relation)
}

func NewTypedIdent(typ string, name string) string {
	return fmt.Sprintf("%s:%s", typ, name)
}

func NewResourceIdent(group, resource, subresource, name string) string {
	return fmt.Sprintf("%s:%s/%s", TypeResource, FormatGroupResource(group, resource, subresource), name)
}

func NewFolderIdent(name string) string {
	return fmt.Sprintf("%s:%s", TypeFolder, name)
}

func NewGroupResourceIdent(group, resource, subresource string) string {
	return fmt.Sprintf("%s:%s", TypeGroupResouce, FormatGroupResource(group, resource, subresource))
}

func FormatGroupResource(group, resource, subresource string) string {
	if subresource != "" {
		return fmt.Sprintf("%s/%s/%s", group, resource, subresource)
	}

	return fmt.Sprintf("%s/%s", group, resource)
}

func NewResourceTuple(subject, relation, group, resource, subresource, name string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewResourceIdent(group, resource, subresource, name),
		Condition: &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(FormatGroupResource(group, resource, subresource)),
				},
			},
		},
	}
}

func isFolderResourceRelationSet(relation string) bool {
	return relation == RelationFolderResourceSetView ||
		relation == RelationFolderResourceSetEdit ||
		relation == RelationFolderResourceSetAdmin
}

func NewFolderResourceTuple(subject, relation, group, resource, subresource, folder string) *openfgav1.TupleKey {
	relation = FolderResourceRelation(relation)
	var condition *openfgav1.RelationshipCondition
	if !isFolderResourceRelationSet(relation) {
		condition = &openfgav1.RelationshipCondition{
			Name: "folder_group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resources": structpb.NewListValue(&structpb.ListValue{
						Values: []*structpb.Value{structpb.NewStringValue(FormatGroupResource(group, resource, subresource))},
					}),
				},
			},
		}
	}

	return &openfgav1.TupleKey{
		User:      subject,
		Relation:  relation,
		Object:    NewFolderIdent(folder),
		Condition: condition,
	}
}

func NewGroupResourceTuple(subject, relation, group, resource, subresource string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		User:     subject,
		Relation: relation,
		Object:   NewGroupResourceIdent(group, resource, subresource),
	}
}

func NewFolderParentTuple(folder, parent string) *openfgav1.TupleKey {
	return &openfgav1.TupleKey{
		Object:   NewFolderIdent(folder),
		Relation: RelationParent,
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

func ToOpenFGATupleKeys(tuples []*authzextv1.TupleKey) []*openfgav1.TupleKey {
	result := make([]*openfgav1.TupleKey, 0, len(tuples))
	for _, t := range tuples {
		result = append(result, ToOpenFGATupleKey(t))
	}
	return result
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

func AddRenderContext(req *openfgav1.CheckRequest) {
	if req.ContextualTuples == nil {
		req.ContextualTuples = &openfgav1.ContextualTupleKeys{}
	}
	if req.ContextualTuples.TupleKeys == nil {
		req.ContextualTuples.TupleKeys = make([]*openfgav1.TupleKey, 0)
	}

	req.ContextualTuples.TupleKeys = append(req.ContextualTuples.TupleKeys, &openfgav1.TupleKey{
		User:     req.TupleKey.User,
		Relation: RelationSetView,
		Object: NewGroupResourceIdent(
			dashboardalpha1.DashboardResourceInfo.GroupResource().Group,
			dashboardalpha1.DashboardResourceInfo.GroupResource().Resource,
			"",
		),
	})
}
