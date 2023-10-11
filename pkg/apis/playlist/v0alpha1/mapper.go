package v0alpha1

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

type NamespaceMapper = func(orgId int64) string

func GetNamespaceMapper(cfg *setting.Cfg) NamespaceMapper {
	if cfg.StackID != "" {
		return func(orgId int64) string { return "stack-" + cfg.StackID }
	}
	return OrgNamespaceMapper
}

func OrgNamespaceMapper(orgId int64) string {
	if orgId == 1 {
		return "default"
	}
	return fmt.Sprintf("org-%d", orgId)
}
