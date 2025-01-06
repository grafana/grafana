package mappers

type VerbToAction map[string]string                            // e.g. "get" -> "read"
type ResourceVerbToAction map[string]VerbToAction              // e.g. "dashboards" -> VerbToAction
type GroupResourceVerbToAction map[string]ResourceVerbToAction // e.g. "dashboard.grafana.app" -> ResourceVerbToAction

type ResourceToAttribute map[string]string                   // e.g. "dashboards" -> "uid"
type GroupResourceToAttribute map[string]ResourceToAttribute // e.g. "dashboard.grafana.app" -> ResourceToAttribute

type K8sRbacMapper struct {
	DefaultActions   VerbToAction
	DefaultAttribute string
	Actions          GroupResourceVerbToAction
	Attributes       GroupResourceToAttribute
}

func NewK8sRbacMapper() *K8sRbacMapper {
	return &K8sRbacMapper{
		DefaultActions: VerbToAction{
			"get":              "read",
			"list":             "read",
			"watch":            "read",
			"create":           "create",
			"update":           "write",
			"patch":            "write",
			"delete":           "delete",
			"deletecollection": "delete",
		},
		DefaultAttribute: "uid",
		Actions: GroupResourceVerbToAction{
			"dashboard.grafana.app": ResourceVerbToAction{"dashboards": VerbToAction{}},
			"folder.grafana.app":    ResourceVerbToAction{"folders": VerbToAction{}},
		},
	}
}

func (m *K8sRbacMapper) Action(group, resource, verb string) (string, bool) {
	if resourceActions, ok := m.Actions[group]; ok {
		if actions, ok := resourceActions[resource]; ok {
			if action, ok := actions[verb]; ok {
				// If the action is explicitly set empty
				// it means that the action is not allowed
				if action == "" {
					return "", false
				}
				return action, true
			}
			if defaultAction, ok := m.DefaultActions[verb]; ok {
				return resource + ":" + defaultAction, true
			}
		}
	}
	return "", false
}

func (m *K8sRbacMapper) Scope(group, resource, name string) (string, bool) {
	if resourceAttributes, ok := m.Attributes[group]; ok {
		if attribute, ok := resourceAttributes[resource]; ok {
			return resource + ":" + attribute + ":" + name, true
		}
	}
	if m.DefaultAttribute != "" {
		return resource + ":" + m.DefaultAttribute + ":" + name, true
	}
	return "", false
}
