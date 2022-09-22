package query

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNoQueriesFound        = errutil.NewBase(errutil.StatusBadRequest, "query.noQueries", errutil.WithPublicMessage("No queries found")).Errorf("no queries found")
	ErrInvalidDatasourceID   = errutil.NewBase(errutil.StatusBadRequest, "query.invalidDatasourceId", errutil.WithPublicMessage("Query does not contain a valid data source identifier")).Errorf("invalid data source identifier")
	ErrMultipleDatasources   = errutil.NewBase(errutil.StatusBadRequest, "query.differentDatasources", errutil.WithPublicMessage("All queries must use the same datasource")).Errorf("all queries must use the same datasource")
	ErrMissingDataSourceInfo = errutil.NewBase(errutil.StatusBadRequest, "query.missingDataSourceInfo").MustTemplate("query missing datasource info: {{ .Public.RefId }}", errutil.WithPublic("Query {{ .Public.RefId }} is missing datasource information"))
)
