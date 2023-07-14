package expr

import "github.com/grafana/grafana/pkg/util/errutil"

func MakeReadError(refID string, err error) error {
	return errutil.NewBase(
		errutil.StatusBadRequest,
		"sse.readData",
	).MustTemplate(
		"[{{ .Public.refId }}] got error: {{ .Error }}",
		errutil.WithPublic("failed to read data from from query {{ .Public.refId }}"),
	).Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"refId": refID,
		},
		Error: err,
	})
}
