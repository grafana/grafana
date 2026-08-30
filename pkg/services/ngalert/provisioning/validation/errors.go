package validation

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	ErrProvenanceChangeNotAllowed = errutil.Forbidden("alerting.notifications.invalidProvenance").MustTemplate(
		"Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be changed to '{{ .Public.TargetProvenance }}. Reason: {{ .Public.Reason }}'",
		errutil.WithPublic("Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be changed to '{{ .Public.TargetProvenance }}'. You must use appropriate API and permissions to manage this resource"),
	)
)

func MakeErrProvenanceChangeNotAllowed(from, to models.Provenance) error {
	if to == "" {
		to = "none"
	}
	if from == "" {
		from = "none"
	}
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"TargetProvenance": to,
			"SourceProvenance": from,
			"Reason":           "-",
		},
	}
	return ErrProvenanceChangeNotAllowed.Build(data)
}

func MakeErrProvenanceChangeNotAllowedWithReason(from, to models.Provenance, reason string) error {
	if to == "" {
		to = "none"
	}
	if from == "" {
		from = "none"
	}
	data := errutil.TemplateData{
		Public: map[string]interface{}{
			"TargetProvenance": to,
			"SourceProvenance": from,
			"Reason":           reason,
		},
	}
	return ErrProvenanceChangeNotAllowed.Build(data)
}
