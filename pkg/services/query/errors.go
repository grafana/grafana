package query

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrNoQueriesFound        = errutil.NewBase(errutil.StatusBadRequest, "query.noQueries", errutil.WithPublicMessage("No queries found")).Errorf("no queries found")
	ErrInvalidDatasourceID   = errutil.NewBase(errutil.StatusBadRequest, "query.invalidDatasourceId", errutil.WithPublicMessage("Query does not contain a valid data source identifier")).Errorf("invalid data source identifier")
	ErrMissingDataSourceInfo = errutil.NewBase(errutil.StatusBadRequest, "query.missingDataSourceInfo").MustTemplate("query missing datasource info: {{ .Public.RefId }}", errutil.WithPublic("Query {{ .Public.RefId }} is missing datasource information"))
	ErrQueryParamMismatch    = errutil.NewBase(errutil.StatusBadRequest, "query.headerMismatch", errutil.WithPublicMessage("The request headers point to a different plugin than is defined in the request body")).Errorf("plugin header/body mismatch")
	ErrDuplicateRefId        = errutil.NewBase(errutil.StatusBadRequest, "query.duplicateRefId", errutil.WithPublicMessage("Multiple queries using the same RefId is not allowed ")).Errorf("multiple queries using the same RefId is not allowed")
)
