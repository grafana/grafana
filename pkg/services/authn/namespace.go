package authn

import (
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

const (
	NamespaceUser           = identity.NamespaceUser
	NamespaceAPIKey         = identity.NamespaceAPIKey
	NamespaceServiceAccount = identity.NamespaceServiceAccount
	NamespaceAnonymous      = identity.NamespaceAnonymous
	NamespaceRenderService  = identity.NamespaceRenderService
	NamespaceAccessPolicy   = identity.NamespaceAccessPolicy
)

var AnonymousNamespaceID = NewNamespaceID(NamespaceAnonymous, 0)

type NamespaceID = identity.NamespaceID

var (
	ParseNamespaceID      = identity.ParseNamespaceID
	MustParseNamespaceID  = identity.MustParseNamespaceID
	NewNamespaceID        = identity.NewNamespaceID
	ErrInvalidNamespaceID = identity.ErrInvalidNamespaceID
)
