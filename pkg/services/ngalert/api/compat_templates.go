package api

import (
	"github.com/grafana/alerting/definition"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
)

func ModelToNotificationTemplates(tmpls []v1.TemplateGroup) []definitions.NotificationTemplate {
	out := make([]definitions.NotificationTemplate, 0, len(tmpls))
	for _, tmpl := range tmpls {
		out = append(out, ModelToNotificationTemplate(tmpl))
	}
	return out
}

func ModelToNotificationTemplate(tmpl v1.TemplateGroup) definitions.NotificationTemplate {
	return definitions.NotificationTemplate{
		UID:             string(tmpl.UID),
		Name:            tmpl.Title,
		Template:        tmpl.Content,
		Provenance:      definitions.Provenance(tmpl.Provenance),
		ResourceVersion: tmpl.Version,
		Kind:            definition.TemplateKind(tmpl.Kind),
	}
}
