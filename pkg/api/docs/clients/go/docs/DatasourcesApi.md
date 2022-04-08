# \DatasourcesApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddDatasource**](DatasourcesApi.md#AddDatasource) | **Post** /datasources | Create a data source.
[**DatasourceProxyDELETEcalls**](DatasourcesApi.md#DatasourceProxyDELETEcalls) | **Delete** /datasources/proxy/{datasource_id}/{datasource_proxy_route} | Data source proxy DELETE calls.
[**DatasourceProxyGETcalls**](DatasourcesApi.md#DatasourceProxyGETcalls) | **Get** /datasources/proxy/{datasource_id}/{datasource_proxy_route} | Data source proxy GET calls.
[**DatasourceProxyPOSTcalls**](DatasourcesApi.md#DatasourceProxyPOSTcalls) | **Post** /datasources/proxy/{datasource_id}/{datasource_proxy_route} | Data source proxy POST calls.
[**DeleteDatasourceByID**](DatasourcesApi.md#DeleteDatasourceByID) | **Delete** /datasources/{datasource_id} | Delete an existing data source by id.
[**DeleteDatasourceByName**](DatasourcesApi.md#DeleteDatasourceByName) | **Delete** /datasources/name/{datasource_name} | Delete an existing data source by name.
[**DeleteDatasourceByUID**](DatasourcesApi.md#DeleteDatasourceByUID) | **Delete** /datasources/uid/{datasource_uid} | Delete an existing data source by UID.
[**GetDatasourceByID**](DatasourcesApi.md#GetDatasourceByID) | **Get** /datasources/{datasource_id} | Get a single data source by Id.
[**GetDatasourceByName**](DatasourcesApi.md#GetDatasourceByName) | **Get** /datasources/name/{datasource_name} | Get a single data source by Name.
[**GetDatasourceByUID**](DatasourcesApi.md#GetDatasourceByUID) | **Get** /datasources/uid/{datasource_uid} | Get a single data source by UID.
[**GetDatasourceIdByName**](DatasourcesApi.md#GetDatasourceIdByName) | **Get** /datasources/id/{datasource_name} | Get data source Id by Name.
[**GetDatasources**](DatasourcesApi.md#GetDatasources) | **Get** /datasources | Get all data sources.
[**QueryDatasource**](DatasourcesApi.md#QueryDatasource) | **Post** /tsdb/query | Query metrics.
[**UpdateDatasource**](DatasourcesApi.md#UpdateDatasource) | **Put** /datasources/{datasource_id} | Update an existing data source.


# **AddDatasource**
> InlineResponse2006 AddDatasource(ctx, body)
Create a data source.

By defining `password` and `basicAuthPassword` under secureJsonData property Grafana encrypts them securely as an encrypted blob in the database. The response then lists the encrypted fields under secureJsonFields.  If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:create`

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.AddDataSourceCommand**](models.AddDataSourceCommand.md)|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DatasourceProxyDELETEcalls**
> DatasourceProxyDELETEcalls(ctx, datasourceId, datasourceProxyRoute)
Data source proxy DELETE calls.

Proxies all calls to the actual data source.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 
  **datasourceProxyRoute** | **string**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DatasourceProxyGETcalls**
> DatasourceProxyGETcalls(ctx, datasourceId, datasourceProxyRoute)
Data source proxy GET calls.

Proxies all calls to the actual data source.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 
  **datasourceProxyRoute** | **string**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DatasourceProxyPOSTcalls**
> DatasourceProxyPOSTcalls(ctx, datasourceId, datasourceProxyRoute, datasourceProxyParam)
Data source proxy POST calls.

Proxies all calls to the actual data source. The data source should support POST methods for the specific path and role as defined

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 
  **datasourceProxyRoute** | **string**|  | 
  **datasourceProxyParam** | **interface{}**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteDatasourceByID**
> SuccessResponseBody DeleteDatasourceByID(ctx, datasourceId)
Delete an existing data source by id.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteDatasourceByName**
> InlineResponse2008 DeleteDatasourceByName(ctx, datasourceName)
Delete an existing data source by name.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceName** | **string**|  | 

### Return type

[**InlineResponse2008**](inline_response_200_8.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteDatasourceByUID**
> SuccessResponseBody DeleteDatasourceByUID(ctx, datasourceUid)
Delete an existing data source by UID.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:delete` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:kLtEtcRGk` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceUid** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDatasourceByID**
> dtos.DataSource GetDatasourceByID(ctx, datasourceId)
Get a single data source by Id.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**dtos.DataSource**](dtos.DataSource.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDatasourceByName**
> dtos.DataSource GetDatasourceByName(ctx, datasourceName)
Get a single data source by Name.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceName** | **string**|  | 

### Return type

[**dtos.DataSource**](dtos.DataSource.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDatasourceByUID**
> dtos.DataSource GetDatasourceByUID(ctx, datasourceUid)
Get a single data source by UID.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:uid:*` and `datasources:uid:kLtEtcRGk` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceUid** | **string**|  | 

### Return type

[**dtos.DataSource**](dtos.DataSource.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDatasourceIdByName**
> InlineResponse2007 GetDatasourceIdByName(ctx, datasourceName)
Get data source Id by Name.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:read` and scopes: `datasources:*`, `datasources:name:*` and `datasources:name:test_datasource` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceName** | **string**|  | 

### Return type

[**InlineResponse2007**](inline_response_200_7.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDatasources**
> dtos.DataSourceList GetDatasources(ctx, )
Get all data sources.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:read` and scope: `datasources:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**dtos.DataSourceList**](dtos.DataSourceList.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **QueryDatasource**
> DataResponse QueryDatasource(ctx, body)
Query metrics.

Please refer to [updated API](#/ds/queryMetricsWithExpressions) instead  Queries a data source having backend implementation.  Most of Grafana’s builtin data sources have backend implementation.  If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:query`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**MetricRequest**](MetricRequest.md)|  | 

### Return type

[**DataResponse**](DataResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateDatasource**
> InlineResponse2006 UpdateDatasource(ctx, datasourceId, body)
Update an existing data source.

Similar to creating a data source, `password` and `basicAuthPassword` should be defined under secureJsonData in order to be stored securely as an encrypted blob in the database. Then, the encrypted fields are listed under secureJsonFields section in the response.  If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:write` and scopes: `datasources:*`, `datasources:id:*` and `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 
  **body** | [**models.UpdateDataSourceCommand**](models.UpdateDataSourceCommand.md)|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

