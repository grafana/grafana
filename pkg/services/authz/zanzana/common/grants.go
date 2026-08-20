package common

import (
	"sort"
	"strings"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

const normalizedSubject = "user:normalized"

type normalizedPermission struct {
	level int
	verbs map[string]struct{}
}

// NormalizeGrantTuples converts stored permission tuples into the stable grants
// contract without exposing tuple subjects, object encodings, or conditions.
func NormalizeGrantTuples(tuples []*authzextv1.TupleKey, types []*authzextv1.ResourceType) *authzextv1.GetGrantsResult {
	global := make(map[string]*authzextv1.GlobalGrant)
	folders := make(map[string]*authzextv1.FolderGrant)
	folderResources := make(map[string]*authzextv1.FolderResourceGrant)
	resources := make(map[string]*authzextv1.ResourceGrant)
	permissions := make(map[any]*normalizedPermission)

	merge := func(target any, relation string) {
		permission := permissions[target]
		if permission == nil {
			permission = &normalizedPermission{verbs: make(map[string]struct{})}
			permissions[target] = permission
		}
		level, verb := normalizeRelation(relation)
		if level > permission.level {
			permission.level = level
		}
		if verb != "" {
			permission.verbs[verb] = struct{}{}
		}
	}

	for _, tuple := range tuples {
		if tuple == nil {
			continue
		}

		objectType, objectName, _ := SplitTupleObject(tuple.GetObject())
		switch objectType {
		case TypeGroupResouce:
			target := toProtoResourceType(parseGroupResourceObject(tuple.GetObject()))
			if !matchesType(target, types) {
				continue
			}
			key := resourceTypeKey(target)
			grant := global[key]
			if grant == nil {
				grant = &authzextv1.GlobalGrant{Type: target}
				global[key] = grant
			}
			merge(grant, tuple.GetRelation())
		case TypeFolder:
			normalizeFolderTuple(tuple, objectName, types, folders, folderResources, merge)
		case TypeResource:
			resource, name := parseResourceObjectGR(tuple.GetObject())
			targets := protoConditionResources(tuple)
			if len(targets) == 0 {
				targets = []*authzextv1.ResourceType{toProtoResourceType(resource)}
			}
			for _, target := range targets {
				if !matchesType(target, types) {
					continue
				}
				key := resourceTypeKey(target) + "\x00" + name
				grant := resources[key]
				if grant == nil {
					grant = &authzextv1.ResourceGrant{Type: target, Name: name}
					resources[key] = grant
				}
				merge(grant, tuple.GetRelation())
			}
		case TypeTeam, TypeUser, TypeServiceAccount:
			targets := protoConditionResources(tuple)
			if len(targets) == 0 {
				targets = []*authzextv1.ResourceType{typedResourceType(objectType)}
			}
			for _, target := range targets {
				if !matchesType(target, types) {
					continue
				}
				key := resourceTypeKey(target) + "\x00" + objectName
				grant := resources[key]
				if grant == nil {
					grant = &authzextv1.ResourceGrant{Type: target, Name: objectName}
					resources[key] = grant
				}
				merge(grant, tuple.GetRelation())
			}
		}
	}

	result := &authzextv1.GetGrantsResult{}
	for _, grant := range global {
		grant.Permission = toProtoPermission(permissions[grant])
		result.GlobalGrants = append(result.GlobalGrants, grant)
	}
	for _, grant := range folders {
		grant.Permission = toProtoPermission(permissions[grant])
		result.FolderGrants = append(result.FolderGrants, grant)
	}
	for _, grant := range folderResources {
		grant.Permission = toProtoPermission(permissions[grant])
		result.FolderResourceGrants = append(result.FolderResourceGrants, grant)
	}
	for _, grant := range resources {
		grant.Permission = toProtoPermission(permissions[grant])
		result.ResourceGrants = append(result.ResourceGrants, grant)
	}

	sortGrants(result)
	return result
}

func normalizeFolderTuple(
	tuple *authzextv1.TupleKey,
	folderUID string,
	types []*authzextv1.ResourceType,
	folders map[string]*authzextv1.FolderGrant,
	folderResources map[string]*authzextv1.FolderResourceGrant,
	merge func(any, string),
) {
	if !strings.HasPrefix(tuple.GetRelation(), "resource_") {
		grant := folders[folderUID]
		if grant == nil {
			grant = &authzextv1.FolderGrant{FolderUid: folderUID}
			folders[folderUID] = grant
		}
		merge(grant, tuple.GetRelation())
		return
	}

	targets := protoConditionResources(tuple)
	if len(targets) == 0 {
		key := folderUID + "\x00*"
		grant := folderResources[key]
		if grant == nil {
			grant = &authzextv1.FolderResourceGrant{FolderUid: folderUID, AllResourceTypes: true}
			folderResources[key] = grant
		}
		merge(grant, tuple.GetRelation())
		return
	}

	for _, target := range targets {
		if !matchesType(target, types) {
			continue
		}
		key := folderUID + "\x00" + resourceTypeKey(target)
		grant := folderResources[key]
		if grant == nil {
			grant = &authzextv1.FolderResourceGrant{FolderUid: folderUID, Type: target}
			folderResources[key] = grant
		}
		merge(grant, tuple.GetRelation())
	}
}

// GrantTuplesFromResult converts normalized grants back to tuple shapes so the
// legacy RBAC adapter can retain its established translation behavior.
func GrantTuplesFromResult(result *authzextv1.GetGrantsResult) []*authzextv1.TupleKey {
	if result == nil {
		return nil
	}

	var tuples []*authzextv1.TupleKey
	for _, grant := range result.GetGlobalGrants() {
		if grant.GetType() == nil {
			continue
		}
		for _, relation := range permissionRelations(grant.GetPermission()) {
			tuples = append(tuples, ToAuthzExtTupleKey(NewGroupResourceTuple(normalizedSubject, relation, grant.GetType().GetGroup(), grant.GetType().GetResource(), grant.GetType().GetSubresource())))
		}
	}
	for _, grant := range result.GetFolderGrants() {
		for _, relation := range permissionRelations(grant.GetPermission()) {
			tuples = append(tuples, ToAuthzExtTupleKey(NewFolderTuple(normalizedSubject, relation, grant.GetFolderUid())))
		}
	}
	for _, grant := range result.GetFolderResourceGrants() {
		if !grant.GetAllResourceTypes() && grant.GetType() == nil {
			continue
		}
		for _, relation := range permissionRelations(grant.GetPermission()) {
			if grant.GetAllResourceTypes() {
				tuples = append(tuples, ToAuthzExtTupleKey(NewTypedTuple(TypeFolder, normalizedSubject, SubresourceRelation(relation), grant.GetFolderUid())))
				continue
			}
			target := grant.GetType()
			tuples = append(tuples, ToAuthzExtTupleKey(NewFolderResourceTuple(normalizedSubject, relation, target.GetGroup(), target.GetResource(), target.GetSubresource(), grant.GetFolderUid())))
		}
	}
	for _, grant := range result.GetResourceGrants() {
		target := grant.GetType()
		if target == nil {
			continue
		}
		for _, relation := range permissionRelations(grant.GetPermission()) {
			if typ := typedObjectType(target); typ != "" {
				tuples = append(tuples, ToAuthzExtTupleKey(NewTypedTuple(typ, normalizedSubject, relation, grant.GetName())))
				continue
			}
			tuples = append(tuples, ToAuthzExtTupleKey(NewResourceTuple(normalizedSubject, relation, target.GetGroup(), target.GetResource(), target.GetSubresource(), grant.GetName())))
		}
	}
	return tuples
}

// TranslateGrants maps the normalized grants contract to legacy RBAC actions and
// scopes. Tuple reconstruction remains an internal compatibility detail.
func TranslateGrants(result *authzextv1.GetGrantsResult) []GrantPermission {
	tuples := GrantTuplesFromResult(result)
	permissions := make([]GrantPermission, 0, len(tuples))
	for _, tuple := range tuples {
		permissions = append(permissions, TranslateGrantTuple(tuple)...)
	}
	return permissions
}

func normalizeRelation(relation string) (int, string) {
	relation = strings.TrimPrefix(relation, "resource_")
	switch relation {
	case RelationSetView:
		return 1, ""
	case RelationSetEdit:
		return 2, ""
	case RelationSetAdmin:
		return 3, ""
	default:
		return 0, relation
	}
}

func toProtoPermission(permission *normalizedPermission) *authzextv1.GrantPermission {
	if permission == nil {
		return nil
	}
	result := &authzextv1.GrantPermission{}
	switch permission.level {
	case 1:
		result.Level = RelationSetView
	case 2:
		result.Level = RelationSetEdit
	case 3:
		result.Level = RelationSetAdmin
	}
	for verb := range permission.verbs {
		result.AdditionalVerbs = append(result.AdditionalVerbs, verb)
	}
	sort.Strings(result.AdditionalVerbs)
	return result
}

func permissionRelations(permission *authzextv1.GrantPermission) []string {
	if permission == nil {
		return nil
	}
	relations := append([]string(nil), permission.GetAdditionalVerbs()...)
	if permission.GetLevel() != "" {
		relations = append(relations, permission.GetLevel())
	}
	sort.Strings(relations)
	return relations
}

func protoConditionResources(tuple *authzextv1.TupleKey) []*authzextv1.ResourceType {
	resources := grantConditionResources(tuple)
	result := make([]*authzextv1.ResourceType, 0, len(resources))
	for _, resource := range resources {
		result = append(result, toProtoResourceType(resource))
	}
	return result
}

func toProtoResourceType(resource grResource) *authzextv1.ResourceType {
	return &authzextv1.ResourceType{Group: resource.group, Resource: resource.resource, Subresource: resource.subresource}
}

func typedResourceType(objectType string) *authzextv1.ResourceType {
	switch objectType {
	case TypeTeam:
		return &authzextv1.ResourceType{Group: iamGroup, Resource: teamsResource}
	case TypeUser:
		return &authzextv1.ResourceType{Group: iamGroup, Resource: usersResource}
	case TypeServiceAccount:
		return &authzextv1.ResourceType{Group: iamGroup, Resource: KindServiceAccounts}
	default:
		return &authzextv1.ResourceType{}
	}
}

func typedObjectType(resourceType *authzextv1.ResourceType) string {
	if resourceType.GetGroup() != iamGroup || resourceType.GetSubresource() != "" {
		return ""
	}
	switch resourceType.GetResource() {
	case teamsResource:
		return TypeTeam
	case usersResource:
		return TypeUser
	case KindServiceAccounts:
		return TypeServiceAccount
	default:
		return ""
	}
}

func matchesType(target *authzextv1.ResourceType, types []*authzextv1.ResourceType) bool {
	if len(types) == 0 {
		return true
	}
	for _, requested := range types {
		if requested.GetGroup() != target.GetGroup() || requested.GetResource() != target.GetResource() {
			continue
		}
		if requested.GetSubresource() == "" || requested.GetSubresource() == target.GetSubresource() {
			return true
		}
	}
	return false
}

func resourceTypeKey(resourceType *authzextv1.ResourceType) string {
	return resourceType.GetGroup() + "\x00" + resourceType.GetResource() + "\x00" + resourceType.GetSubresource()
}

func sortGrants(result *authzextv1.GetGrantsResult) {
	sort.Slice(result.GlobalGrants, func(i, j int) bool {
		return resourceTypeKey(result.GlobalGrants[i].GetType()) < resourceTypeKey(result.GlobalGrants[j].GetType())
	})
	sort.Slice(result.FolderGrants, func(i, j int) bool {
		return result.FolderGrants[i].GetFolderUid() < result.FolderGrants[j].GetFolderUid()
	})
	sort.Slice(result.FolderResourceGrants, func(i, j int) bool {
		left, right := result.FolderResourceGrants[i], result.FolderResourceGrants[j]
		return left.GetFolderUid()+"\x00"+resourceTypeKey(left.GetType()) < right.GetFolderUid()+"\x00"+resourceTypeKey(right.GetType())
	})
	sort.Slice(result.ResourceGrants, func(i, j int) bool {
		left, right := result.ResourceGrants[i], result.ResourceGrants[j]
		return resourceTypeKey(left.GetType())+"\x00"+left.GetName() < resourceTypeKey(right.GetType())+"\x00"+right.GetName()
	})
}
