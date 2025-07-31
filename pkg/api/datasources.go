package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/datasource"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

var datasourcesLogger = log.New("datasources")

// swagger:route GET /datasources datasources getDataSources
//
// Get all data sources.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scope: `datasources:*`.
//
// Responses:
// 200: getDataSourcesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetDataSources(c *contextmodel.ReqContext) response.Response {
	cfg := hs.Cfg.Get()
	query := datasources.GetDataSourcesQuery{OrgID: c.GetOrgID(), DataSourceLimit: cfg.DataSourceLimit}

	dataSources, err := hs.DataSourcesService.GetDataSources(c.Req.Context(), &query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to query datasources", err)
	}

	filtered, err := hs.dsGuardian.New(c.SignedInUser.OrgID, c.SignedInUser).FilterDatasourcesByReadPermissions(dataSources)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to query datasources", err)
	}

	result := make(dtos.DataSourceList, 0)
	for _, ds := range filtered {
		dsItem := dtos.DataSourceListItemDTO{
			OrgId:     ds.OrgID,
			Id:        ds.ID,
			UID:       ds.UID,
			Name:      ds.Name,
			Url:       ds.URL,
			Type:      ds.Type,
			TypeName:  ds.Type,
			Access:    ds.Access,
			Database:  ds.Database,
			User:      ds.User,
			BasicAuth: ds.BasicAuth,
			IsDefault: ds.IsDefault,
			JsonData:  ds.JsonData,
			ReadOnly:  ds.ReadOnly,
		}

		if plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type); exists {
			dsItem.TypeLogoUrl = plugin.Info.Logos.Small
			dsItem.TypeName = plugin.Name
			dsItem.Type = plugin.ID // may be from an alias
		} else {
			dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
		}

		result = append(result, dsItem)
	}

	sort.Sort(result)

	return response.JSON(http.StatusOK, &result)
}

// swagger:route GET /datasources/{id} datasources getDataSourceByID
//
// Get a single data source by Id.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Please refer to [updated API](#/datasources/getDataSourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: getDataSourceResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDataSourceById(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", nil)
	}
	query := datasources.GetDataSourceQuery{
		ID:    id,
		OrgID: c.GetOrgID(),
	}

	dataSource, err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		if errors.Is(err, datasources.ErrDataSourceIdentifierNotSet) {
			return response.Error(http.StatusBadRequest, "Datasource id is missing", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasources", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), dataSource)

	// Add accesscontrol metadata
	dto.AccessControl = getAccessControlMetadata(c, datasources.ScopePrefix, dto.UID)

	return response.JSON(http.StatusOK, &dto)
}

// swagger:route DELETE /datasources/{id} datasources deleteDataSourceByID
//
// Delete an existing data source by id.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).
//
// Please refer to [updated API](#/datasources/deleteDataSourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 404: notFoundError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) DeleteDataSourceById(c *contextmodel.ReqContext) response.Response {
	id, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}

	if id <= 0 {
		return response.Error(http.StatusBadRequest, "Missing valid datasource id", nil)
	}

	ds, err := hs.getRawDataSourceById(c.Req.Context(), id, c.GetOrgID())
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusBadRequest, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(http.StatusForbidden, "Cannot delete read-only data source", nil)
	}

	cmd := &datasources.DeleteDataSourceCommand{ID: id, OrgID: c.GetOrgID(), Name: ds.Name}

	err = hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.GetOrgID(), ds.UID)

	return response.Success("Data source deleted")
}

// swagger:route GET /datasources/uid/{uid} datasources getDataSourceByUID
//
// Get a single data source by UID.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:kLtEtcRGk` (single data source).
//
// Responses:
// 200: getDataSourceResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDataSourceByUID(c *contextmodel.ReqContext) response.Response {
	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), web.Params(c.Req)[":uid"], c.GetOrgID())
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasource", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), ds)

	// Add accesscontrol metadata
	dto.AccessControl = getAccessControlMetadata(c, datasources.ScopePrefix, dto.UID)

	return response.JSON(http.StatusOK, &dto)
}

// swagger:route DELETE /datasources/uid/{uid} datasources deleteDataSourceByUID
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
func (hs *HTTPServer) DeleteDataSourceByUID(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]

	if uid == "" {
		return response.Error(http.StatusBadRequest, "Missing datasource uid", nil)
	}

	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), uid, c.GetOrgID())
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusBadRequest, "Failed to delete datasource", nil)
	}

	if ds.ReadOnly {
		return response.Error(http.StatusForbidden, "Cannot delete read-only data source", nil)
	}

	cmd := &datasources.DeleteDataSourceCommand{UID: uid, OrgID: c.GetOrgID(), Name: ds.Name}

	err = hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.GetOrgID(), ds.UID)

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Data source deleted",
		"id":      ds.ID,
	})
}

// swagger:route DELETE /datasources/name/{name} datasources deleteDataSourceByName
//
// Delete an existing data source by name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: deleteDataSourceByNameResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) DeleteDataSourceByName(c *contextmodel.ReqContext) response.Response {
	name := web.Params(c.Req)[":name"]

	if name == "" {
		return response.Error(http.StatusBadRequest, "Missing valid datasource name", nil)
	}

	getCmd := &datasources.GetDataSourceQuery{Name: name, OrgID: c.GetOrgID()}
	dataSource, err := hs.DataSourcesService.GetDataSource(c.Req.Context(), getCmd)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete datasource", err)
	}

	if dataSource.ReadOnly {
		return response.Error(http.StatusForbidden, "Cannot delete read-only data source", nil)
	}

	cmd := &datasources.DeleteDataSourceCommand{Name: name, OrgID: c.GetOrgID()}
	err = hs.DataSourcesService.DeleteDataSource(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete datasource", err)
	}

	hs.Live.HandleDatasourceDelete(c.GetOrgID(), dataSource.UID)

	return response.JSON(http.StatusOK, util.DynMap{
		"message": "Data source deleted",
		"id":      dataSource.ID,
	})
}

func validateURL(cmdType string, url string) response.Response {
	if _, err := datasource.ValidateURL(cmdType, url); err != nil {
		datasourcesLogger.Error("Failed to validate URL", "url", url)
		return response.Error(http.StatusBadRequest, "Validation error, invalid URL", err)
	}

	return nil
}

// validateJSONData prevents the user from adding a custom header with name that matches the auth proxy header name.
// This is done to prevent data source proxy from being used to circumvent auth proxy.
// For more context take a look at CVE-2022-35957
func validateJSONData(jsonData *simplejson.Json, settingsProvider setting.SettingsProvider) error {
	cfg := settingsProvider.Get()
	if jsonData == nil {
		return nil
	}

	if cfg.AuthProxy.Enabled {
		for key, value := range jsonData.MustMap() {
			if strings.HasPrefix(key, datasources.CustomHeaderName) {
				header := fmt.Sprint(value)
				if http.CanonicalHeaderKey(header) == http.CanonicalHeaderKey(cfg.AuthProxy.HeaderName) {
					datasourcesLogger.Error("Forbidden to add a data source header with a name equal to auth proxy header name", "headerName", key)
					return errors.New("validation error, invalid header name specified")
				}
			}
		}
	}

	return nil
}

// swagger:route POST /datasources datasources addDataSource
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
func (hs *HTTPServer) AddDataSource(c *contextmodel.ReqContext) response.Response {
	cmd := datasources.AddDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}

	userID, _ := identity.UserIdentifier(c.GetID())

	datasourcesLogger.Debug("Received command to add data source", "url", cmd.URL)
	cmd.OrgID = c.GetOrgID()
	cmd.UserID = userID
	if cmd.URL != "" {
		if resp := validateURL(cmd.Type, cmd.URL); resp != nil {
			return resp
		}
	}

	if err := validateJSONData(cmd.JsonData, hs.Cfg); err != nil {
		return response.Error(http.StatusBadRequest, "Failed to add datasource", err)
	}

	// It's forbidden to update the rules from the datasource api.
	// team HTTP headers update have to be done through `updateDatasourceLBACRules`
	if cmd.JsonData != nil {
		if _, ok := cmd.JsonData.CheckGet("teamHttpHeaders"); ok {
			return response.Error(http.StatusForbidden, "Cannot create datasource with team HTTP headers, need to use updateDatasourceLBACRules API", nil)
		}
	}

	dataSource, err := hs.DataSourcesService.AddDataSource(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNameExists) || errors.Is(err, datasources.ErrDataSourceUidExists) {
			return response.Error(http.StatusConflict, err.Error(), err)
		}

		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to add datasource", err)
	}

	// Clear permission cache for the user who's created the data source, so that new permissions are fetched for their next call
	// Required for cases when caller wants to immediately interact with the newly created object
	hs.accesscontrolService.ClearUserPermissionCache(c.SignedInUser)

	ds := hs.convertModelToDtos(c.Req.Context(), dataSource)
	return response.JSON(http.StatusOK, util.DynMap{
		"message":    "Datasource added",
		"id":         dataSource.ID,
		"name":       dataSource.Name,
		"datasource": ds,
	})
}

// swagger:route PUT /datasources/{id} datasources updateDataSourceByID
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
// Please refer to [updated API](#/datasources/updateDataSourceByUID) instead
//
// Deprecated: true
//
// Responses:
// 200: createOrUpdateDatasourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

func (hs *HTTPServer) UpdateDataSourceByID(c *contextmodel.ReqContext) response.Response {
	cmd := datasources.UpdateDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.URL)
	cmd.OrgID = c.GetOrgID()
	var err error
	if cmd.ID, err = strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64); err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", err)
	}
	if resp := validateURL(cmd.Type, cmd.URL); resp != nil {
		return resp
	}
	if err := validateJSONData(cmd.JsonData, hs.Cfg); err != nil {
		return response.Error(http.StatusBadRequest, "Failed to update datasource", err)
	}
	ds, err := hs.getRawDataSourceById(c.Req.Context(), cmd.ID, cmd.OrgID)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update datasource", err)
	}

	return hs.updateDataSourceByID(c, ds, cmd)
}

// swagger:route PUT /datasources/uid/{uid} datasources updateDataSourceByUID
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
// 409: conflictError
// 500: internalServerError
func (hs *HTTPServer) UpdateDataSourceByUID(c *contextmodel.ReqContext) response.Response {
	cmd := datasources.UpdateDataSourceCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	datasourcesLogger.Debug("Received command to update data source", "url", cmd.URL)
	cmd.OrgID = c.GetOrgID()
	if resp := validateURL(cmd.Type, cmd.URL); resp != nil {
		return resp
	}
	if err := validateJSONData(cmd.JsonData, hs.Cfg); err != nil {
		return response.Error(http.StatusBadRequest, "Failed to update datasource", err)
	}

	ds, err := hs.getRawDataSourceByUID(c.Req.Context(), web.Params(c.Req)[":uid"], c.GetOrgID())
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update datasource", err)
	}
	cmd.ID = ds.ID

	return hs.updateDataSourceByID(c, ds, cmd)
}

func (hs *HTTPServer) updateDataSourceByID(c *contextmodel.ReqContext, ds *datasources.DataSource, cmd datasources.UpdateDataSourceCommand) response.Response {
	if ds.ReadOnly {
		return response.Error(http.StatusForbidden, "Cannot update read-only data source", nil)
	}

	_, err := hs.DataSourcesService.UpdateDataSource(c.Req.Context(), &cmd)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNameExists) {
			return response.Error(http.StatusConflict, "Failed to update datasource: "+err.Error(), err)
		}

		if errors.Is(err, datasources.ErrDataSourceUpdatingOldVersion) {
			return response.Error(http.StatusConflict, "Datasource has already been updated by someone else. Please reload and try again", err)
		}

		return response.ErrOrFallback(http.StatusInternalServerError, "Failed to update datasource", err)
	}

	query := datasources.GetDataSourceQuery{
		ID:    cmd.ID,
		OrgID: c.GetOrgID(),
	}

	dataSource, err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasource", err)
	}

	datasourceDTO := hs.convertModelToDtos(c.Req.Context(), dataSource)

	hs.Live.HandleDatasourceUpdate(c.GetOrgID(), datasourceDTO.UID)

	return response.JSON(http.StatusOK, util.DynMap{
		"message":    "Datasource updated",
		"id":         cmd.ID,
		"name":       cmd.Name,
		"datasource": datasourceDTO,
	})
}

func (hs *HTTPServer) getRawDataSourceById(ctx context.Context, id int64, orgID int64) (*datasources.DataSource, error) {
	query := datasources.GetDataSourceQuery{
		ID:    id,
		OrgID: orgID,
	}

	dataSource, err := hs.DataSourcesService.GetDataSource(ctx, &query)
	if err != nil {
		return nil, err
	}

	return dataSource, nil
}

func (hs *HTTPServer) getRawDataSourceByUID(ctx context.Context, uid string, orgID int64) (*datasources.DataSource, error) {
	query := datasources.GetDataSourceQuery{
		UID:   uid,
		OrgID: orgID,
	}

	dataSource, err := hs.DataSourcesService.GetDataSource(ctx, &query)
	if err != nil {
		return nil, err
	}

	return dataSource, nil
}

// swagger:route GET /datasources/name/{name} datasources getDataSourceByName
//
// Get a single data source by Name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: getDataSourceResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) GetDataSourceByName(c *contextmodel.ReqContext) response.Response {
	query := datasources.GetDataSourceQuery{Name: web.Params(c.Req)[":name"], OrgID: c.GetOrgID()}

	dataSource, err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasources", err)
	}

	dto := hs.convertModelToDtos(c.Req.Context(), dataSource)
	return response.JSON(http.StatusOK, &dto)
}

// swagger:route GET /datasources/id/{name} datasources getDataSourceIdByName
//
// Get data source Id by Name.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled
// you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).
//
// Responses:
// 200: getDataSourceIDResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (hs *HTTPServer) GetDataSourceIdByName(c *contextmodel.ReqContext) response.Response {
	query := datasources.GetDataSourceQuery{Name: web.Params(c.Req)[":name"], OrgID: c.GetOrgID()}

	ds, err := hs.DataSourcesService.GetDataSource(c.Req.Context(), &query)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return response.Error(http.StatusNotFound, "Data source not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query datasources", err)
	}

	dtos := dtos.AnyId{
		Id: ds.ID,
	}

	return response.JSON(http.StatusOK, &dtos)
}

// swagger:route GET /datasources/{id}/resources/{datasource_proxy_route} datasources callDatasourceResourceByID
//
// Fetch data source resources by Id.
//
// Please refer to [updated API](#/datasources/callDatasourceResourceWithUID) instead
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
func (hs *HTTPServer) CallDatasourceResource(c *contextmodel.ReqContext) {
	datasourceID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		c.JsonApiErr(http.StatusBadRequest, "id is invalid", nil)
		return
	}
	ds, err := hs.DataSourceCache.GetDatasource(c.Req.Context(), datasourceID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			c.JsonApiErr(403, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(500, "Unable to load datasource meta data", err)
		return
	}

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		c.JsonApiErr(500, "Unable to find datasource plugin", err)
		return
	}

	hs.callPluginResourceWithDataSource(c, plugin.ID, ds)
}

// swagger:route GET /datasources/uid/{uid}/resources/{datasource_proxy_route} datasources callDatasourceResourceWithUID
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
func (hs *HTTPServer) CallDatasourceResourceWithUID(c *contextmodel.ReqContext) {
	dsUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(dsUID) {
		c.JsonApiErr(http.StatusBadRequest, "UID is invalid", nil)
		return
	}

	ds, err := hs.DataSourceCache.GetDatasourceByUID(c.Req.Context(), dsUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			c.JsonApiErr(http.StatusForbidden, "Access denied to datasource", err)
			return
		}
		c.JsonApiErr(http.StatusInternalServerError, "Unable to load datasource meta data", err)
		return
	}

	plugin, exists := hs.pluginStore.Plugin(c.Req.Context(), ds.Type)
	if !exists {
		c.JsonApiErr(http.StatusInternalServerError, "Unable to find datasource plugin", err)
		return
	}

	hs.callPluginResourceWithDataSource(c, plugin.ID, ds)
}

func (hs *HTTPServer) convertModelToDtos(ctx context.Context, ds *datasources.DataSource) dtos.DataSource {
	dto := dtos.DataSource{
		Id:               ds.ID,
		UID:              ds.UID,
		OrgId:            ds.OrgID,
		Name:             ds.Name,
		Url:              ds.URL,
		Type:             ds.Type,
		Access:           ds.Access,
		Database:         ds.Database,
		User:             ds.User,
		BasicAuth:        ds.BasicAuth,
		BasicAuthUser:    ds.BasicAuthUser,
		WithCredentials:  ds.WithCredentials,
		IsDefault:        ds.IsDefault,
		JsonData:         ds.JsonData,
		SecureJsonFields: map[string]bool{},
		Version:          ds.Version,
		ReadOnly:         ds.ReadOnly,
		APIVersion:       ds.APIVersion,
	}

	if hs.pluginStore != nil {
		if plugin, exists := hs.pluginStore.Plugin(ctx, ds.Type); exists {
			dto.TypeLogoUrl = plugin.Info.Logos.Small
			dto.Type = plugin.ID // may be from an alias
		} else {
			dto.TypeLogoUrl = "public/img/icn-datasource.svg"
		}
	}

	secrets, err := hs.DataSourcesService.DecryptedValues(ctx, ds)
	if err == nil {
		for k, v := range secrets {
			if len(v) > 0 {
				dto.SecureJsonFields[k] = true
			}
		}
	} else {
		datasourcesLogger.Debug("Failed to retrieve datasource secrets to parse secure json fields", "error", err)
	}

	return dto
}

// swagger:route GET /datasources/uid/{uid}/health datasources checkDatasourceHealthWithUID
//
// Sends a health check request to the plugin datasource identified by the UID.
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) CheckDatasourceHealthWithUID(c *contextmodel.ReqContext) response.Response {
	dsUID := web.Params(c.Req)[":uid"]
	if !util.IsValidShortUID(dsUID) {
		return response.Error(http.StatusBadRequest, "UID is invalid", nil)
	}

	ds, err := hs.DataSourceCache.GetDatasourceByUID(c.Req.Context(), dsUID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			return response.Error(http.StatusForbidden, "Access denied to datasource", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to load datasource metadata", err)
	}
	return hs.checkDatasourceHealth(c, ds)
}

// swagger:route GET /datasources/{id}/health datasources checkDatasourceHealthByID
//
// Sends a health check request to the plugin datasource identified by the ID.
//
// Please refer to [updated API](#/datasources/checkDatasourceHealthWithUID) instead
//
// Deprecated: true
//
// Responses:
// 200: okResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (hs *HTTPServer) CheckDatasourceHealth(c *contextmodel.ReqContext) response.Response {
	datasourceID, err := strconv.ParseInt(web.Params(c.Req)[":id"], 10, 64)
	if err != nil {
		return response.Error(http.StatusBadRequest, "id is invalid", nil)
	}

	ds, err := hs.DataSourceCache.GetDatasource(c.Req.Context(), datasourceID, c.SignedInUser, c.SkipDSCache)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceAccessDenied) {
			return response.Error(http.StatusForbidden, "Access denied to datasource", err)
		}
		return response.Error(http.StatusInternalServerError, "Unable to load datasource metadata", err)
	}
	return hs.checkDatasourceHealth(c, ds)
}

func (hs *HTTPServer) checkDatasourceHealth(c *contextmodel.ReqContext, ds *datasources.DataSource) response.Response {
	pCtx, err := hs.pluginContextProvider.GetWithDataSource(c.Req.Context(), ds.Type, c.SignedInUser, ds)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "Unable to get plugin context", err)
	}
	req := &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
	}

	err = hs.DataSourceRequestValidator.Validate(ds, c.Req)
	if err != nil {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	resp, err := hs.pluginClient.CheckHealth(c.Req.Context(), req)
	if err != nil {
		return translatePluginRequestErrorToAPIError(err)
	}

	payload := map[string]any{
		"status":  resp.Status.String(),
		"message": resp.Message,
	}

	// Unmarshal JSONDetails if it's not empty.
	if len(resp.JSONDetails) > 0 {
		var jsonDetails map[string]any
		err = json.Unmarshal(resp.JSONDetails, &jsonDetails)
		if err != nil {
			return response.Error(http.StatusInternalServerError, "Failed to unmarshal detailed response from backend plugin", err)
		}

		payload["details"] = jsonDetails
	}

	if resp.Status != backend.HealthStatusOk {
		return response.JSON(http.StatusBadRequest, payload)
	}

	return response.JSON(http.StatusOK, payload)
}

// swagger:parameters checkDatasourceHealthByID
type CheckDatasourceHealthByIDParams struct {
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters callDatasourceResourceByID
type CallDatasourceResourceByIDParams struct {
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters deleteDataSourceByID
type DeleteDataSourceByIDParams struct {
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters getDataSourceByID
type GetDataSourceByIDParams struct {
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters checkDatasourceHealthWithUID
type CheckDatasourceHealthWithUIDParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:parameters callDatasourceResourceWithUID
type CallDatasourceResourceWithUIDParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:parameters deleteDataSourceByUID
type DeleteDataSourceByUIDParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:parameters getDataSourceByUID
type GetDataSourceByUIDParams struct {
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:parameters getDataSourceByName
type GetDataSourceByNameParams struct {
	// in:path
	// required:true
	DatasourceName string `json:"name"`
}

// swagger:parameters deleteDataSourceByName
type DeleteDataSourceByNameParams struct {
	// in:path
	// required:true
	DatasourceName string `json:"name"`
}

// swagger:parameters getDataSourceIdByName
type GetDataSourceIdByNameParams struct {
	// in:path
	// required:true
	DatasourceName string `json:"name"`
}

// swagger:parameters addDataSource
type AddDataSourceParams struct {
	// in:body
	// required:true
	Body datasources.AddDataSourceCommand
}

// swagger:parameters updateDataSourceByID
type UpdateDataSourceByIDParams struct {
	// in:body
	// required:true
	Body datasources.UpdateDataSourceCommand
	// in:path
	// required:true
	DatasourceID string `json:"id"`
}

// swagger:parameters updateDataSourceByUID
type UpdateDataSourceByUIDParams struct {
	// in:body
	// required:true
	Body datasources.UpdateDataSourceCommand
	// in:path
	// required:true
	DatasourceUID string `json:"uid"`
}

// swagger:response getDataSourcesResponse
type GetDataSourcesResponse struct {
	// The response message
	// in: body
	Body dtos.DataSourceList `json:"body"`
}

// swagger:response getDataSourceResponse
type GetDataSourceResponse struct {
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

// swagger:response getDataSourceIDResponse
type GetDataSourceIDresponse struct {
	// The response message
	// in: body
	Body struct {
		// ID Identifier of the data source.
		// required: true
		// example: 65
		ID int64 `json:"id"`
	} `json:"body"`
}

// swagger:response deleteDataSourceByNameResponse
type DeleteDataSourceByNameResponse struct {
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
