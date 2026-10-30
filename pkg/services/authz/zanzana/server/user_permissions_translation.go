package server

import (
	"context"
	"slices"
	"strings"
	"sync"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/tuple"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/schema"
)

// Keep only the bundled schema metadata needed to reject unsupported tuple forms.
var permissionGrantMetadata = sync.OnceValues(func() (map[string]*openfgav1.Metadata, error) {
	model, err := schema.TransformModulesToModel(schema.SchemaModules)
	if err != nil {
		return nil, err
	}
	metadata := make(map[string]*openfgav1.Metadata, len(model.GetTypeDefinitions()))
	for _, definition := range model.GetTypeDefinitions() {
		metadata[definition.GetType()] = definition.GetMetadata()
	}
	return metadata, nil
})

func unsupportedPermissionGrant() error {
	return status.Error(codes.FailedPrecondition, "unsupported permission relationship or condition")
}

func validatePermissionCondition(grant *openfgav1.TupleKey) error {
	condition := grant.GetCondition()
	if condition == nil {
		return nil
	}
	fields := condition.GetContext().GetFields()
	if len(fields) != 1 {
		return unsupportedPermissionGrant()
	}
	switch condition.GetName() {
	case "group_filter":
		if value, ok := fields["group_resource"].GetKind().(*structpb.Value_StringValue); !ok || value.StringValue == "" {
			return unsupportedPermissionGrant()
		}
	case "subresource_filter":
		value, ok := fields["subresources"].GetKind().(*structpb.Value_ListValue)
		if !ok {
			return unsupportedPermissionGrant()
		}
		for _, item := range value.ListValue.GetValues() {
			if v, ok := item.GetKind().(*structpb.Value_StringValue); !ok || v.StringValue == "" {
				return unsupportedPermissionGrant()
			}
		}
	default:
		return unsupportedPermissionGrant()
	}
	return nil
}

// Translate only the schema's direct grants and computed local relations.
// Parent edges are deliberately absent: legacy scopes describe grant locations.
func translatePermissionGrants(ctx context.Context, grants []*openfgav1.TupleKey) ([]permissionListResult, error) {
	for _, grant := range grants {
		if err := validatePermissionGrant(grant); err != nil {
			return nil, err
		}
	}
	results := make([]permissionListResult, 0, len(common.SupportedActions()))
	for _, entry := range common.SupportedActions() {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		info := common.NewResourceInfoFromList(&authzv1.ListRequest{Group: entry.Group, Resource: entry.Resource, Subresource: entry.Subresource})
		relation := common.VerbMapping[entry.Verb]
		list := &authzv1.ListResponse{}
		for _, grant := range grants {
			typ, name, _ := strings.Cut(grant.GetObject(), ":")
			granted := grant.GetRelation()
			switch {
			case typ == common.TypeGroupResouce:
				if name == info.GroupResource() && permissionLevelImplies(granted, relation) {
					list.All = true
				}
			case info.IsGeneric() && typ == common.TypeResource:
				prefix := info.GroupResource() + "/"
				if strings.HasPrefix(name, prefix) && grant.GetCondition().GetContext().GetFields()["group_resource"].GetStringValue() == info.GroupResource() && info.IsValidRelation(relation) && permissionLevelImplies(granted, relation) {
					list.Items = append(list.Items, strings.TrimPrefix(name, prefix))
				}
			case info.IsGeneric() && typ == common.TypeFolder:
				subresource := common.SubresourceRelation(relation)
				matches := common.IsSubresourceRelation(subresource) && permissionSubresourceImplies(granted, subresource) && permissionConditionMatches(grant, info.GroupResource())
				if isFolderPermissionBasedResource(info.GroupResource()) && permissionFolderContentsImplies(granted, relation) {
					matches = true
				}
				if matches && (name != accesscontrol.GeneralFolderUID || info.UsesRootFolderPermissions() || relation == common.RelationCreate) {
					list.Folders = append(list.Folders, name)
					if info.UsesRootFolderPermissions() && name == accesscontrol.GeneralFolderUID {
						list.Folders = append(list.Folders, "")
					}
				}
			case !info.IsGeneric() && typ == info.Type():
				matches := false
				if info.HasSubresource() && info.IsValidRelation(common.SubresourceRelation(relation)) {
					matches = permissionSubresourceImplies(granted, common.SubresourceRelation(relation)) && permissionConditionMatches(grant, info.GroupResource())
				}
				if info.IsValidRelation(relation) {
					switch typ {
					case common.TypeFolder:
						matches = matches || slices.Contains(expandedSubresourcePermissionRelations(common.SubresourceRelation(relation)), common.SubresourceRelation(granted))
					case common.TypeTeam:
						matches = matches || granted == relation || (granted == common.RelationTeamMember && relation == common.RelationGet) || (granted == common.RelationTeamAdmin && relation != common.RelationCreate)
					default:
						matches = matches || granted == relation
					}
				}
				if matches {
					list.Items = append(list.Items, name)
				}
			}
		}
		if list.All {
			list.Items = nil
			list.Folders = nil
		} else {
			slices.Sort(list.Items)
			list.Items = slices.Compact(list.Items)
			slices.Sort(list.Folders)
			list.Folders = slices.Compact(list.Folders)
		}
		results = append(results, permissionListResult{Entry: entry, List: list})
	}
	return results, nil
}

func permissionLevelImplies(granted, requested string) bool {
	if granted == requested {
		return true
	}
	switch requested {
	case common.RelationSetView, common.RelationGet:
		return granted == common.RelationSetView || granted == common.RelationSetEdit || granted == common.RelationSetAdmin
	case common.RelationSetEdit, common.RelationUpdate, common.RelationDelete:
		return granted == common.RelationSetEdit || granted == common.RelationSetAdmin
	case common.RelationGetPermissions, common.RelationSetPermissions:
		return granted == common.RelationSetAdmin
	}
	return false
}

func permissionSubresourceImplies(granted, requested string) bool {
	return slices.Contains(expandedSubresourcePermissionRelations(requested), granted)
}

func permissionFolderContentsImplies(granted, requested string) bool {
	switch requested {
	case common.RelationGet:
		return granted == common.RelationSetView || granted == common.RelationSetEdit || granted == common.RelationSetAdmin
	case common.RelationCreate, common.RelationUpdate, common.RelationDelete:
		return granted == common.RelationSetEdit || granted == common.RelationSetAdmin
	case common.RelationGetPermissions, common.RelationSetPermissions:
		return granted == common.RelationSetAdmin
	}
	return false
}

func permissionConditionMatches(grant *openfgav1.TupleKey, group string) bool {
	if grant.GetCondition() == nil {
		return true
	}
	for _, item := range grant.GetCondition().GetContext().GetFields()["subresources"].GetListValue().GetValues() {
		if item.GetStringValue() == group {
			return true
		}
	}
	return false
}

func validatePermissionGrant(grant *openfgav1.TupleKey) error {
	if err := validatePermissionCondition(grant); err != nil {
		return err
	}
	metadata, err := permissionGrantMetadata()
	if err != nil {
		return err
	}
	if !tuple.IsValidObject(grant.GetObject()) || !tuple.IsValidUser(grant.GetUser()) {
		return unsupportedPermissionGrant()
	}
	typ, name, ok := strings.Cut(grant.GetObject(), ":")
	subject, subjectRelation, _ := strings.Cut(grant.GetUser(), "#")
	subjectType, subjectName, subjectOK := strings.Cut(subject, ":")
	if !ok || name == "" || strings.Contains(name, "*") || !subjectOK || subjectName == "" || subjectName == "*" {
		return unsupportedPermissionGrant()
	}
	if typ == common.TypeResource {
		group := grant.GetCondition().GetContext().GetFields()["group_resource"].GetStringValue()
		if group == "" || !strings.HasPrefix(name, group+"/") || name == group+"/" {
			return unsupportedPermissionGrant()
		}
	}
	for _, allowed := range metadata[typ].GetRelations()[grant.GetRelation()].GetDirectlyRelatedUserTypes() {
		if allowed.GetWildcard() == nil && allowed.GetType() == subjectType && allowed.GetRelation() == subjectRelation && allowed.GetCondition() == grant.GetCondition().GetName() {
			return nil
		}
	}
	return unsupportedPermissionGrant()
}

func composePermissionContributions(contributions [][]permissionListResult) []permissionListResult {
	results := make([]permissionListResult, 0, len(common.SupportedActions()))
	indexes := make(map[string]int)
	for _, entry := range common.SupportedActions() {
		indexes[entry.Action] = len(results)
		results = append(results, permissionListResult{Entry: entry, List: &authzv1.ListResponse{}})
	}
	for _, contribution := range contributions {
		for _, grant := range contribution {
			result := results[indexes[grant.Entry.Action]].List
			result.All = result.All || grant.List.All
			result.Items = append(result.Items, grant.List.Items...)
			result.Folders = append(result.Folders, grant.List.Folders...)
		}
	}
	for _, result := range results {
		if result.List.All {
			result.List.Items = nil
			result.List.Folders = nil
			continue
		}
		slices.Sort(result.List.Items)
		result.List.Items = slices.Compact(result.List.Items)
		slices.Sort(result.List.Folders)
		result.List.Folders = slices.Compact(result.List.Folders)
	}
	return results
}
