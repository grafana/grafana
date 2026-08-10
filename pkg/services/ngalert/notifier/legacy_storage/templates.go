package legacy_storage

import v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"

func (rev *ConfigRevision) HasTemplateWithTitle(title string) bool {
	for _, tmpl := range rev.Config.Templates {
		if tmpl.Title == title {
			return true
		}
	}
	return false
}

func (rev *ConfigRevision) SetTemplate(tmpl v1.TemplateGroup) v1.TemplateGroup {
	if rev.Config.Templates == nil {
		rev.Config.Templates = make(map[v1.ResourceUID]v1.TemplateGroup, 1)
	}
	// Ensure template UID and Version are valid and set.
	tmpl.UID = v1.TemplateUID(tmpl.Kind, tmpl.Title)
	tmpl.Version = v1.CalculateTemplateFingerprint(tmpl)
	rev.Config.Templates[tmpl.UID] = tmpl
	return tmpl
}

func (rev *ConfigRevision) DeleteTemplate(uid v1.ResourceUID) {
	delete(rev.Config.Templates, uid)
}
