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

	RelationSubresourceSetView  = common.RelationSubresourceSetView
	RelationSubresourceSetEdit  = common.RelationSubresourceSetEdit
	RelationSubresourceSetAdmin = common.RelationSubresourceSetAdmin

	RelationSubresourceRead   = common.RelationSubresourceGet
	RelationSubresourceWrite  = common.RelationSubresourceUpdate
	RelationSubresourceCreate = common.RelationSubresourceCreate
	RelationSubresourceDelete = common.RelationSubresourceDelete
)

var (
	RelationsFolder      = common.RelationsTyped
	RelationsResouce     = common.RelationsResource
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
	TranslateToResourceTuple  = common.TranslateToResourceTuple
	IsFolderResourceTuple     = common.IsFolderResourceTuple
	MergeFolderResourceTuples = common.MergeFolderResourceTuples

	TranslateToCheckRequest  = common.TranslateToCheckRequest
	TranslateToListRequest   = common.TranslateToListRequest
	TranslateToGroupResource = common.TranslateToGroupResource
	TranslateBasicRole       = common.TranslateBasicRole
)
