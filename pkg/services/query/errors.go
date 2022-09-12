package query

import (
	"errors"

	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrQueryValidationFailure = errutil.NewBase(errutil.StatusBadRequest, "query.validationError").MustTemplate("query validation failed: {{ .Error }}", errutil.WithPublic("{{ .Public.Message }}"))

func queryValidationError(publicMessage string) error {
	return ErrQueryValidationFailure.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"Message": util.Capitalize(publicMessage),
		},
		Error: errors.New(publicMessage),
	})
}
