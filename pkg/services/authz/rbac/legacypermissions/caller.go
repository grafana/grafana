package legacypermissions

import (
	"github.com/go-jose/go-jose/v4/jwt"
	authnlib "github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
)

const LegacyUserPermissionsGrant = "authz.grafana.app/legacyuserpermissions:get"
const LegacyUserPermissionsSearchGrant = "authz.grafana.app/legacyuserpermissions:search"

// LegacyPermissionCaller represents only the trusted in-process Grafana service,
// never the user whose permissions are being enumerated.
func LegacyPermissionCaller(namespace string) types.AuthInfo {
	return authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authnlib.AccessTokenClaims{Namespace: namespace, Permissions: []string{LegacyUserPermissionsGrant}},
	})
}

func LegacySearchPermissionCaller(namespace string) types.AuthInfo {
	return authnlib.NewAccessTokenAuthInfo(authnlib.Claims[authnlib.AccessTokenClaims]{
		Claims: jwt.Claims{Subject: "access-policy:embedded-grafana"},
		Rest:   authnlib.AccessTokenClaims{Namespace: namespace, Permissions: []string{LegacyUserPermissionsGrant, LegacyUserPermissionsSearchGrant}},
	})
}
