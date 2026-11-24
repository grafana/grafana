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

// FindTemplate returns the template with the given kind and title, whatever its UID is.
func (rev *ConfigRevision) FindTemplate(kind v1.TemplateKind, title string) (v1.TemplateGroup, bool) {
	for _, tmpl := range rev.Config.Templates {
		if tmpl.Kind == kind && tmpl.Title == title {
			return tmpl, true
		}
	}
	return v1.TemplateGroup{}, false
}

func (rev *ConfigRevision) SetTemplate(tmpl v1.TemplateGroup) v1.TemplateGroup {
	if rev.Config.Templates == nil {
		rev.Config.Templates = make(map[v1.ResourceUID]v1.TemplateGroup, 1)
	}
	// The template keeps the UID that it is given, as it is its identity: the caller either has the one that it already
	// has, or has assigned a new one. Only the version is derived.
	tmpl.Version = v1.CalculateTemplateFingerprint(tmpl)
	rev.Config.Templates[tmpl.UID] = tmpl
	return tmpl
}

func (rev *ConfigRevision) DeleteTemplate(uid v1.ResourceUID) {
	delete(rev.Config.Templates, uid)
}
