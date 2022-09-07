package query

import (
	"errors"

	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var ErrBadQuery = errutil.NewBase(errutil.StatusBadRequest, "query.badRequest").MustTemplate("Bad plugin request: {{ .Error }}", errutil.WithPublic("{{ .Public.Message }}"))

func badQueryErr(publicMessage string) error {
	return ErrBadQuery.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"Message": util.Capitalize(publicMessage),
		},
		Error: errors.New(publicMessage),
	})
}
