package rbac

import (
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type translation struct {
	resource      string
	attribute     string
	verbMapping   map[string]string
	folderSupport bool
}

func (t translation) action(verb string) (string, bool) {
	action, ok := t.verbMapping[verb]
	return action, ok
}

func (t translation) scope(name string) string {
	return t.resource + ":" + t.attribute + ":" + name
}

func (t translation) prefix() string {
	return t.resource + ":" + t.attribute + ":"
}

func newResourceTranslation(resource string, attribute string, folderSupport bool) translation {
	defaultMapping := func(r string) map[string]string {
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

	return translation{
		resource:      resource,
		attribute:     attribute,
		verbMapping:   defaultMapping(resource),
		folderSupport: folderSupport,
	}
}

type mapper map[string]map[string]translation

func newMapper() mapper {
	return map[string]map[string]translation{
		"dashboard.grafana.app": {
			"dashboards": newResourceTranslation("dashboards", "uid", true),
		},
		"folder.grafana.app": {
			"folders": newResourceTranslation("folders", "uid", true),
		},
		"iam.grafana.app": {
			"teams": newResourceTranslation("teams", "id", false),
		},
		"secret.grafana.app": {
			"securevalues": newResourceTranslation("secret.securevalues", "uid", false),
			"keepers":      newResourceTranslation("secret.keepers", "uid", false),
		},
		"query.grafana.app": {
			"query": translation{
				resource:  "datasources",
				attribute: "uid",
				verbMapping: map[string]string{
					utils.VerbCreate: "datasources:query",
				},
				folderSupport: false,
			},
		},
	}
}

func (m mapper) translation(group, resource string) (translation, bool) {
	resources, ok := m[group]
	if !ok {
		return translation{}, false
	}

	t, ok := resources[resource]
	if !ok {
		return translation{}, false
	}

	return t, true
}
