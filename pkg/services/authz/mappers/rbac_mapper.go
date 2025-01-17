package mappers

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const defaultAttribute = "uid"

type VerbMapping map[string]string                           // e.g. "get" -> "read"
type ResourceVerbMapping map[string]VerbMapping              // e.g. "dashboards" -> VerbToAction
type GroupResourceVerbMapping map[string]ResourceVerbMapping // e.g. "dashboard.grafana.app" -> ResourceVerbToAction

type ResourceAttributeMapping map[string]string                        // e.g. "dashboards" -> "uid"
type GroupResourceAttributeMapping map[string]ResourceAttributeMapping // e.g. "dashboard.grafana.app" -> ResourceToAttribute

type K8sRbacMapper struct {
	GroupResourceVerbMapping      GroupResourceVerbMapping
	GroupResourceAttributeMapping GroupResourceAttributeMapping
}

func NewK8sRbacMapper() *K8sRbacMapper {
	defaultMapping := func(r string) VerbMapping {
		return map[string]string{
			utils.VerbGet:              fmt.Sprintf("%s:read", r),
			utils.VerbList:             fmt.Sprintf("%s:read", r),
			utils.VerbWatch:            fmt.Sprintf("%s:read", r),
			utils.VerbCreate:           fmt.Sprintf("%s:create", r),
			utils.VerbUpdate:           fmt.Sprintf("%s:write", r),
			utils.VerbPatch:            fmt.Sprintf("%s:write", r),
			utils.VerbDelete:           fmt.Sprintf("%s:delete", r),
			utils.VerbDeleteCollection: fmt.Sprintf("%s:delete", r),
			utils.VerbGetPermissions:   fmt.Sprintf("%s.permissions:read", r),
			utils.VerbSetPermissions:   fmt.Sprintf("%s.permissions:write", r),
		}
	}

	return &K8sRbacMapper{
		GroupResourceAttributeMapping: GroupResourceAttributeMapping{},
		GroupResourceVerbMapping: GroupResourceVerbMapping{
			"dashboard.grafana.app": ResourceVerbMapping{"dashboards": defaultMapping("dashboards")},
			"folder.grafana.app":    ResourceVerbMapping{"folders": defaultMapping("folders")},
		},
	}
}

func (m *K8sRbacMapper) Action(group, resource, verb string) (string, bool) {
	if resourceActions, ok := m.GroupResourceVerbMapping[group]; ok {
		if actions, ok := resourceActions[resource]; ok {
			if action, ok := actions[verb]; ok {
				// If the action is explicitly set empty
				// it means that the action is not allowed
				if action == "" {
					return "", false
				}
				return action, true
			}
		}
	}
	return "", false
}

func (m *K8sRbacMapper) Scope(group, resource, name string) (string, bool) {
	if resourceAttributes, ok := m.GroupResourceAttributeMapping[group]; ok {
		if attribute, ok := resourceAttributes[resource]; ok {
			return resource + ":" + attribute + ":" + name, true
		}
	}

	return resource + ":" + defaultAttribute + ":" + name, true
}
