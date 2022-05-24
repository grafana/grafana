package definitions

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

// swagger:route GET /datasources datasources getDatasources
//
// Get all data sources.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scope: `datasources:*`.
//
// Responses:
// 200: getDatasourcesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /datasources datasources addDatasource
//
// Create a data source.
//
// By defining `password` and `basicAuthPassword` under secureJsonData property
// Grafana encrypts them securely as an encrypted blob in the database.
// The response then lists the encrypted fields under secureJsonFields.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:create`
//
// Responses:
// 200: createOrUpdateDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError

// swagger:route PUT /datasources/{id} datasources updateDatasourceByID
//
// Update an existing data source by its sequential ID.
//
// Similar to creating a data source, `password` and `basicAuthPassword` should be defined under
// secureJsonData in order to be stored securely as an encrypted blob in the database. Then, the
// encrypted fields are listed under secureJsonFields section in the response.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:write` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Please refer to [updated API](#/datasources/updateDatasourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: createOrUpdateDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route PUT /datasources/uid/{uid} datasources updateDatasourceByUID
//
// Update an existing data source.
//
// Similar to creating a data source, `password` and `basicAuthPassword` should be defined under
// secureJsonData in order to be stored securely as an encrypted blob in the database. Then, the
// encrypted fields are listed under secureJsonFields section in the response.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:write` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:1` (single data source).
//
// Responses:
// 200: createOrUpdateDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /datasources/{id} datasources deleteDatasourceByID
//
// Delete an existing data source by id.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Please refer to [updated API](#/datasources/deleteDatasourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 404: notFoundError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /datasources/uid/{uid} datasources deleteDatasourceByUID
//
// Delete an existing data source by UID.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:kLtEtcRGk` (single data source).
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /datasources/name/{name} datasources deleteDatasourceByName
//
// Delete an existing data source by name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: deleteDatasourceByNameResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/{id} datasources getDatasourceByID
//
// Get a single data source by Id.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Please refer to [updated API](#/datasources/getDatasourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: getDatasourceResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/uid/{uid} datasources getDatasourceByUID
//
// Get a single data source by UID.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:kLtEtcRGk` (single data source).
//
// Responses:
// 200: getDatasourceResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/{id}/health datasources checkDatasourceHealthByID
//
// Check data source health by Id.
//
// Please refer to [updated API](#/datasources/checkDatasourceHealth) instead
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /datasources/uid/{uid}/health datasources checkDatasourceHealth
//
// Check data source health by Id.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /datasources/{id}/resources/{datasource_proxy_route} datasources fetchDatasourceResourcesByID
//
// Fetch data source resources by Id.
//
// Please refer to [updated API](#/datasources/fetchDatasourceResources) instead
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/uid/{uid}/resources/{datasource_proxy_route} datasources fetchDatasourceResources
//
// Fetch data source resources.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/name/{name} datasources getDatasourceByName
//
// Get a single data source by Name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: getDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /datasources/id/{name} datasources getDatasourceIdByName
//
// Get data source Id by Name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: getDatasourceIDresponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/proxy/{id}/{datasource_proxy_route} datasources datasourceProxyGETcalls
//
// Data source proxy GET calls.
//
// Proxies all calls to the actual data source.
//
// Please refer to [updated API](#/datasources/datasourceProxyGETByUIDcalls) instead
//
// Deprecated: true
//
// Responses:
// 200:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/proxy/uid/{uid}/{datasource_proxy_route} datasources datasourceProxyGETByUIDcalls
//
// Data source proxy GET calls.
//
// Proxies all calls to the actual data source.
//
// Responses:
// 200:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /datasources/proxy/{id}/{datasource_proxy_route} datasources datasourceProxyPOSTcalls
//
// Data source proxy POST calls.
//
// Proxies all calls to the actual data source. The data source should support POST methods for the specific path and role as defined
//
// Please refer to [updated API](#/datasources/datasourceProxyPOSTByUIDcalls) instead
//
// Deprecated: true
//
// Responses:
// 201:
// 202:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /datasources/proxy/uid/{uid}/{datasource_proxy_route} datasources datasourceProxyPOSTByUIDcalls
//
// Data source proxy POST calls.
//
// Proxies all calls to the actual data source. The data source should support POST methods for the specific path and role as defined
//
// Responses:
// 201:
// 202:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /datasources/proxy/{id}/{datasource_proxy_route} datasources datasourceProxyDELETEcalls
//
// Data source proxy DELETE calls.
//
// Proxies all calls to the actual data source.
//
// Please refer to [updated API](#/datasources/datasourceProxyDELETEByUIDcalls) instead
//
// Deprecated: true
//
// Responses:
// 202:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route DELETE /datasources/proxy/uid/{uid}/{datasource_proxy_route} datasources datasourceProxyDELETEByUIDcalls
//
// Data source proxy DELETE calls.
//
// Proxies all calls to the actual data source.
//
// Responses:
// 202:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route POST /tsdb/query datasources queryDatasource
//
// Query metrics.
//
// Please refer to [updated API](#/ds/queryMetricsWithExpressions) instead
//
// Queries a data source having backend implementation.
//
// Most of Grafana’s builtin data sources have backend implementation.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:query`.
//
// Deprecated: true
//
// Responses:
// 200: queryDatasourceResponse
// 401: unauthorisedError
// 400: badRequestError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:parameters updateDatasourceByID deleteDatasourceByID getDatasourceByID datasourceProxyGETcalls datasourceProxyPOSTcalls datasourceProxyDELETEcalls
// swagger:parameters enablePermissions disablePermissions getPermissions deletePermissions
// swagger:parameters checkDatasourceHealthByID fetchDatasourceResourcesByID
type DatasourceID struct {
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters updateDatasourceByUID deleteDatasourceByUID getDatasourceByUID datasourceProxyGETByUIDcalls datasourceProxyPOSTByUIDcalls datasourceProxyDELETEByUIDcalls
// swagger:parameters checkDatasourceHealth fetchDatasourceResources
type DatasourceUID struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:parameters getDatasourceByName deleteDatasourceByName getDatasourceIdByName
type DatasourceName struct {
	// in:path
	// required:true
	DatasourceName string `json:"name"`
}

// swagger:parameters datasourceProxyGETcalls datasourceProxyPOSTcalls datasourceProxyDELETEcalls datasourceProxyGETByUIDcalls
// swagger:parameters datasourceProxyPOSTByUIDcalls datasourceProxyDELETEByUIDcalls
// swagger:parameters fetchDatasourceResources fetchDatasourceResourcesByID
type DatasourceProxyRouteParam struct {
	// in:path
	// required:true
	DatasourceProxyRoute string `json:"datasource_proxy_route"`
}

// swagger:parameters datasourceProxyPOSTcalls
type DatasourceProxyParam struct {
	// in:body
	// required:true
	DatasourceProxyParam interface{}
}

// swagger:parameters addDatasource
type AddDatasourceParam struct {
	// in:body
	// required:true
	Body models.AddDataSourceCommand
}

// swagger:parameters updateDatasourceByID updateDatasourceByUID
type UpdateDatasource struct {
	// in:body
	// required:true
	Body models.UpdateDataSourceCommand
}

// swagger:parameters queryDatasource
type QueryDatasource struct {
	// in:body
	// required:true
	Body dtos.MetricRequest
}

// swagger:response getDatasourcesResponse
type GetDatasourcesResponse struct {
	// The response message
	// in: body
	Body dtos.DataSourceList `json:"body"`
}

// swagger:response getDatasourceResponse
type GetDatasourceResponse struct {
	// The response message
	// in: body
	Body dtos.DataSource `json:"body"`
}

// swagger:response createOrUpdateDatasourceResponse
type CreateOrUpdateDatasourceResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the new data source.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Name of the new data source.
		// required: true
		// example: My Data source
		Name string `json:"name"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Data source added
		Message string `json:"message"`

		// Datasource properties
		// required: true
		Datasource dtos.DataSource `json:"datasource"`
	} `json:"body"`
}

// swagger:response getDatasourceIDresponse
type GetDatasourceIDresponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the data source.
		// required: true
		// example: 65
		ID int64 `json:"id"`
	} `json:"body"`
}

// swagger:response deleteDatasourceByNameResponse
type DeleteDatasourceByNameResponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the deleted data source.
		// required: true
		// example: 65
		ID int64 `json:"id"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response queryDatasourceResponse
type QueryDatasourceResponse struct {
	// The response message
	// in: body
	//nolint: staticcheck // plugins.DataResponse deprecated
	Body legacydata.DataResponse `json:"body"`
}
