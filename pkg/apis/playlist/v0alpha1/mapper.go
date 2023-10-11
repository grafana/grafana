package v0alpha1

import (
	"fmt"

	"github.com/grafana/grafana/pkg/setting"
)

type namespaceMapper = func(orgId int64) string

func getNamespaceMapper(cfg *setting.Cfg) namespaceMapper {
	if cfg.StackID != "" {
		return func(orgId int64) string { return "stack-" + cfg.StackID }
	}
	return orgNamespaceMapper
}

func orgNamespaceMapper(orgId int64) string {
	if orgId == 1 {
		return "default"
	}
	return fmt.Sprintf("org-%d", orgId)
}
