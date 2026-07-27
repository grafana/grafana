package zanzana

import (
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

const (
	TypeUser           = common.TypeUser
	TypeServiceAccount = common.TypeServiceAccount
	TypeRenderService  = common.TypeRenderService
	TypeAnonymous      = common.TypeAnonymous
	TypeTeam           = common.TypeTeam
	TypeRole           = common.TypeRole
	TypeFolder         = common.TypeFolder
	TypeResource       = common.TypeResource
	TypeNamespace      = common.TypeGroupResouce
)

// TokenPermissionUpdate is required for callers to perform write operations against Zanzana (Mutate/Write).
const TokenPermissionUpdate = "zanzana:update" //nolint:gosec // G101: permission identifier, not a credential.

const (
	RelationTeamMember = common.RelationTeamMember
	RelationTeamAdmin  = common.RelationTeamAdmin
	RelationParent     = common.RelationParent
	RelationAssignee   = common.RelationAssignee

	RelationSetView  = common.RelationSetView
	RelationSetEdit  = common.RelationSetEdit
	RelationSetAdmin = common.RelationSetAdmin

	RelationGet    = common.RelationGet
	RelationUpdate = common.RelationUpdate
	RelationCreate = common.RelationCreate
	RelationDelete = common.RelationDelete

	RelationGetPermissions = common.RelationGetPermissions
	RelationSetPermissions = common.RelationSetPermissions

	RelationSubresourceSetView  = common.RelationSubresourceSetView
	RelationSubresourceSetEdit  = common.RelationSubresourceSetEdit
	RelationSubresourceSetAdmin = common.RelationSubresourceSetAdmin

	RelationSubresourceRead   = common.RelationSubresourceGet
	RelationSubresourceWrite  = common.RelationSubresourceUpdate
	RelationSubresourceCreate = common.RelationSubresourceCreate
	RelationSubresourceDelete = common.RelationSubresourceDelete
)

var (
	// RelationsFolder is used by reconciliation to list tuples for folder objects.
	// NOTE: this is NOT common.RelationsFolder. It is a superset: common.RelationsFolder (the
	// relations the authz path validates) PLUS the permission-set relations (view/edit/admin),
	// which are stored on folder objects and so must be enumerated when syncing/deleting tuples.
	RelationsFolder = append(append([]string{}, common.RelationsFolder...),
		common.RelationSetView, common.RelationSetEdit, common.RelationSetAdmin,
	)
	// RelationsResouce is used by reconciliation to list tuples for resource objects.
	// Include permission-set relations for the same reason as RelationsFolder.
	RelationsResouce = append(append([]string{}, common.RelationsResource...),
		common.RelationSetView, common.RelationSetEdit, common.RelationSetAdmin,
	)
	RelationsSubresource = common.RelationsSubresource
)

const (
	KindDashboards = common.KindDashboards
	KindFolders    = common.KindFolders
)

var (
	ToAuthzExtTupleKey                  = common.ToAuthzExtTupleKey
	ToAuthzExtTupleKeys                 = common.ToAuthzExtTupleKeys
	ToAuthzExtTupleKeyWithoutCondition  = common.ToAuthzExtTupleKeyWithoutCondition
	ToAuthzExtTupleKeysWithoutCondition = common.ToAuthzExtTupleKeysWithoutCondition

	ToOpenFGATuple                    = common.ToOpenFGATuple
	ToOpenFGATuples                   = common.ToOpenFGATuples
	ToOpenFGATupleKey                 = common.ToOpenFGATupleKey
	ToOpenFGATupleKeyWithoutCondition = common.ToOpenFGATupleKeyWithoutCondition

	NewTupleEntry             = common.NewTupleEntry
	NewObjectEntry            = common.NewObjectEntry
	NewGroupResourceTuple     = common.NewGroupResourceTuple
	TranslateToResourceTuple  = common.TranslateToResourceTuple
	IsFolderResourceTuple     = common.IsFolderResourceTuple
	MergeFolderResourceTuples = common.MergeFolderResourceTuples

	TranslateToCheckRequest  = common.TranslateToCheckRequest
	TranslateToListRequest   = common.TranslateToListRequest
	TranslateToGroupResource = common.TranslateToGroupResource
	TranslateBasicRole       = common.TranslateBasicRole
)
