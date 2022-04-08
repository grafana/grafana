# \LicensingApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**DeleteLicenseToken**](LicensingApi.md#DeleteLicenseToken) | **Delete** /licensing/token | Remove license from database.
[**GetCustomPermissionsCSV**](LicensingApi.md#GetCustomPermissionsCSV) | **Get** /licensing/custom-permissions-csv | Get custom permissions report in CSV format.
[**GetCustomPermissionsReport**](LicensingApi.md#GetCustomPermissionsReport) | **Get** /licensing/custom-permissions | Get custom permissions report.
[**GetLicenseStatus**](LicensingApi.md#GetLicenseStatus) | **Get** /licensing/check | Check license availability.
[**GetLicenseToken**](LicensingApi.md#GetLicenseToken) | **Get** /licensing/token | Get license token.
[**PostLicenseToken**](LicensingApi.md#PostLicenseToken) | **Post** /licensing/token | Create license token.
[**PostRenewLicenseToken**](LicensingApi.md#PostRenewLicenseToken) | **Post** /licensing/token/renew | Manually force license refresh.
[**RefreshLicenseStats**](LicensingApi.md#RefreshLicenseStats) | **Get** /licensing/refresh-stats | Refresh license stats.


# **DeleteLicenseToken**
> ErrorResponseBody DeleteLicenseToken(ctx, body)
Remove license from database.

Removes the license stored in the Grafana database. Available in Grafana Enterprise v7.4+.  You need to have a permission with action `licensing:delete`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**DeleteTokenCommand**](DeleteTokenCommand.md)|  | 

### Return type

[**ErrorResponseBody**](ErrorResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetCustomPermissionsCSV**
> []CustomPermissionsRecordDto GetCustomPermissionsCSV(ctx, )
Get custom permissions report in CSV format.

You need to have a permission with action `licensing.reports:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]CustomPermissionsRecordDto**](CustomPermissionsRecordDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: text/csv

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetCustomPermissionsReport**
> []CustomPermissionsRecordDto GetCustomPermissionsReport(ctx, )
Get custom permissions report.

You need to have a permission with action `licensing.reports:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]CustomPermissionsRecordDto**](CustomPermissionsRecordDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetLicenseStatus**
> GetLicenseStatus(ctx, )
Check license availability.

### Required Parameters
This endpoint does not need any parameter.

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetLicenseToken**
> Token GetLicenseToken(ctx, )
Get license token.

You need to have a permission with action `licensing:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**Token**](Token.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostLicenseToken**
> Token PostLicenseToken(ctx, body)
Create license token.

You need to have a permission with action `licensing:update`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**DeleteTokenCommand**](DeleteTokenCommand.md)|  | 

### Return type

[**Token**](Token.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostRenewLicenseToken**
> PostRenewLicenseToken(ctx, body)
Manually force license refresh.

Manually ask license issuer for a new token. Available in Grafana Enterprise v7.4+.  You need to have a permission with action `licensing:update`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | **interface{}**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RefreshLicenseStats**
> ActiveUserStats RefreshLicenseStats(ctx, )
Refresh license stats.

You need to have a permission with action `licensing:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**ActiveUserStats**](ActiveUserStats.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

