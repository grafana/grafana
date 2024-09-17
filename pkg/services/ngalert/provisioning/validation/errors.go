package validation

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

var (
	ErrProvenanceChangeNotAllowed = errutil.Forbidden("alerting.notifications.invalidProvenance").MustTemplate(
		"Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be managed via API that handles resources with provenance status '{{ .Public.TargetProvenance }}'",
		errutil.WithPublic("Resource with provenance status '{{ .Public.SourceProvenance }}' cannot be managed via API that handles resources with provenance status '{{ .Public.TargetProvenance }}'. You must use appropriate API to manage this resource"),
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
		},
	}
	return ErrProvenanceChangeNotAllowed.Build(data)
}
