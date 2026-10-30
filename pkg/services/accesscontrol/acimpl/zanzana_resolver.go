package acimpl

import (
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
	"github.com/grafana/grafana/pkg/services/authz/rbac/legacypermissions"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/user"
)

// Keep existing enumeration and search callers source-compatible during migration.
type ZanzanaPermissionResolver = legacypermissions.ZanzanaPermissionResolver

func NewZanzanaPermissionResolver(client zanzana.Client, userSvc user.Service, configProvider restcfg.RestConfigProvider, useExternalGroups bool) *ZanzanaPermissionResolver {
	return legacypermissions.NewZanzanaPermissionResolver(client, userSvc, configProvider, useExternalGroups)
}

func MergePermissions(a, b map[int64][]ac.Permission) map[int64][]ac.Permission {
	return legacypermissions.MergePermissions(a, b)
}

func MergeUserPermissions(legacy, zanzana []ac.Permission) []ac.Permission {
	return legacypermissions.MergeUserPermissions(legacy, zanzana)
}
