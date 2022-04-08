# \DatasourcePermissionsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeletePermissions**](DatasourcePermissionsApi.md#DeletePermissions) | **Delete** /datasources/{datasource_id}/permissions/{permissionId} | Remove permission for a data source.
[**DisablePermissions**](DatasourcePermissionsApi.md#DisablePermissions) | **Post** /datasources/{datasource_id}/disable-permissions | Disable permissions for a data source.
[**EnablePermissions**](DatasourcePermissionsApi.md#EnablePermissions) | **Post** /datasources/{datasource_id}/enable-permissions | Enable permissions for a data source.
[**GetPermissions**](DatasourcePermissionsApi.md#GetPermissions) | **Get** /datasources/{datasource_id}/permissions | Get permissions for a data source.


# **DeletePermissions**
> SuccessResponseBody DeletePermissions(ctx, permissionId, datasourceId)
Remove permission for a data source.

Removes the permission with the given permissionId for the data source with the given id.  You need to have a permission with action `datasources.permissions:delete` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **permissionId** | **string**|  | 
  **datasourceId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DisablePermissions**
> InlineResponse2006 DisablePermissions(ctx, datasourceId)
Disable permissions for a data source.

Disables permissions for the data source with the given id. All existing permissions will be removed and anyone will be able to query the data source.  You need to have a permission with action `datasources.permissions:toggle` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **EnablePermissions**
> InlineResponse2006 EnablePermissions(ctx, datasourceId)
Enable permissions for a data source.

Enables permissions for the data source with the given id. No one except Org Admins will be able to query the data source until permissions have been added which permit certain users or teams to query the data source.  You need to have a permission with action `datasources.permissions:toggle` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetPermissions**
> AddPermissionDto GetPermissions(ctx, datasourceId)
Get permissions for a data source.

Gets all existing permissions for the data source with the given id.  You need to have a permission with action `datasources.permissions:read` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**AddPermissionDto**](AddPermissionDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

