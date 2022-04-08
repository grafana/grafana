# \DashboardVersionsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetDashboardVersion**](DashboardVersionsApi.md#GetDashboardVersion) | **Get** /dashboards/id/{DashboardID}/versions/{DashboardVersionID} | Get a specific dashboard version.
[**GetDashboardVersions**](DashboardVersionsApi.md#GetDashboardVersions) | **Get** /dashboards/id/{DashboardID}/versions | Gets all existing versions for the dashboard.
[**RestoreDashboardVersion**](DashboardVersionsApi.md#RestoreDashboardVersion) | **Post** /dashboards/id/{DashboardID}/restore | Restore a dashboard to a given dashboard version.


# **GetDashboardVersion**
> models.DashboardVersionMeta GetDashboardVersion(ctx, dashboardID, dashboardVersionID)
Get a specific dashboard version.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 
  **dashboardVersionID** | **int64**|  | 

### Return type

[**models.DashboardVersionMeta**](models.DashboardVersionMeta.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDashboardVersions**
> []DashboardVersionDto GetDashboardVersions(ctx, dashboardID, optional)
Gets all existing versions for the dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 
 **optional** | ***DashboardVersionsApiGetDashboardVersionsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a DashboardVersionsApiGetDashboardVersionsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **limit** | **optional.Int64**| Maximum number of results to return | [default to 0]
 **start** | **optional.Int64**| Version to start from when returning queries | [default to 0]

### Return type

[**[]DashboardVersionDto**](DashboardVersionDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RestoreDashboardVersion**
> InlineResponse2004 RestoreDashboardVersion(ctx, dashboardID)
Restore a dashboard to a given dashboard version.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 

### Return type

[**InlineResponse2004**](inline_response_200_4.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

