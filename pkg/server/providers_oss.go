//go:build oss
// +build oss

package server

import (
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// ProvideResourcePermissionsStore provides a resourcepermissions.Store implementation for OSS
func ProvideResourcePermissionsStore(cfg *setting.Cfg, sql db.DB, features featuremgmt.FeatureToggles) resourcepermissions.Store {
	return resourcepermissions.NewStore(cfg, sql, features)
}
