package org

import "github.com/google/wire"

var WireSet = wire.NewSet(
	ProvideOrgIDAuthorizer,
	ProvideOrgRoleAuthorizer,
)
