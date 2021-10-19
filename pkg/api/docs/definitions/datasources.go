package apidocs

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

// swagger:route GET /datasources datasources getDatasources
//
// Get all data sources
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
// Create a data source
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
// 403: quotaReachedError
// 409: conflictError
// 500: internalServerError

// swagger:route PUT /datasources/{datasource_id} datasources updateDatasource
//
// Update an existing data source
//
// Similar to creating a data source, `password` and `basicAuthPassword` should be defined under
// secureJsonData in order to be stored securely as an encrypted blob in the database. Then, the
// encrypted fields are listed under secureJsonFields section in the response.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:write` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Responses:
// 200: createOrUpdateDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /datasources/{datasource_id} datasources deleteDatasourceByID
//
// Delete an existing data source by id
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 404: notFoundError
// 403: forbiddenError
// 500: internalServerError

// swagger:route DELETE /datasources/uid/{datasource_uid} datasources deleteDatasourceByUID
//
// Delete an existing data source by UID
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

// swagger:route DELETE /datasources/name/{datasource_name} datasources deleteDatasourceByName
//
// Delete an existing data source by name
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

// swagger:route GET /datasources/{datasource_id} datasources getDatasourceByID
//
// Get a single data source by Id
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Responses:
// 200: getDatasourceResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /datasources/uid/{datasource_uid} datasources getDatasourceByUID
//
// Get a single data source by UID
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

// swagger:route GET /datasources/name/{datasource_name} datasources getDatasourceByName
//
// Get a single data source by Name
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: getDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /datasources/id/{datasource_name} datasources getDatasourceIdByName
//
// Get data source Id by Name
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

// swagger:route GET /datasources/proxy/{datasource_id} datasources datasourceProxyCalls
//
// Data source proxy calls
//
// Proxies all calls to the actual data source.
//
// Responses:
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError

// swagger:route GET /api/tsdb/query datasources queryDatasource
//
// Query a data source by ID
//
// Queries a data source having backend implementation.
//
// Most of Grafana’s builtin data sources have backend implementation.
//
// Responses:
// 200: queryDatasourceResponse
// 400: badRequestError

// swagger:parameters updateDatasource deleteDatasourceByID getDatasourceByID datasourceProxyCalls
type DatasourceID struct {
	// in:path
	// required:true
	DatasourceID string `json:"datasource_id"`
}

// swagger:parameters deleteDatasourceByUID getDatasourceByUID
type DatasourceUID struct {
	// in:path
	// required:true
	DatasourceUID string `json:"datasource_uid"`
}

// swagger:parameters getDatasourceByName deleteDatasourceByName getDatasourceIdByName
type DatasourceName struct {
	// in:path
	// required:true
	DatasourceName string `json:"datasource_name"`
}

// swagger:parameters addDatasource
type AddDatasourceParam struct {
	// in:body
	Body models.AddDataSourceCommand
}

// swagger:parameters updateDatasource
type UpdateDatasource struct {
	// in:body
	Body models.UpdateDataSourceCommand
}

// swagger:parameters queryDatasource
type QueryDatasource struct {
	// in:body
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

		// Name of the new dashboard.
		// required: true
		// example: My Dashboard
		Name string `json:"name"`

		// Message Message of the deleted dashboard.
		// required: true
		// example: Dashboard My Dashboard deleted
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
	Body plugins.DataResponse `json:"body"`
}
