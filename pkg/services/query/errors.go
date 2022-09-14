package query

import (
	"errors"

	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrQueryValidationFailure = errutil.NewBase(errutil.StatusBadRequest, "query.validationError").MustTemplate("query validation failed: {{ .Error }}", errutil.WithPublic("{{ .Public.Message }}"))
	ErrNoQueriesFound         = errutil.NewBase(errutil.StatusBadRequest, "query.noQueries", errutil.WithPublicMessage("No queries found")).Errorf("no queries found")
	ErrInvalidDatasourceID    = errutil.NewBase(errutil.StatusBadRequest, "query.invalidDatasourceId", errutil.WithPublicMessage("Query does not contain a valid data source identifier")).Errorf("invalid data source identifier")
	ErrMultipleDatasources    = errutil.NewBase(errutil.StatusBadRequest, "query.differentDatasources", errutil.WithPublicMessage("All queries must use the same datasource")).Errorf("all queries must use the same datasource")
)

func queryValidationError(publicMessage string) error {
	return ErrQueryValidationFailure.Build(errutil.TemplateData{
		Public: map[string]interface{}{
			"Message": util.Capitalize(publicMessage),
		},
		Error: errors.New(publicMessage),
	})
}
