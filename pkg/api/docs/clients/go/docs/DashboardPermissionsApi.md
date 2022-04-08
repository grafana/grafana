# \DashboardPermissionsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetDashboardPermissions**](DashboardPermissionsApi.md#GetDashboardPermissions) | **Get** /dashboards/id/{DashboardID}/permissions | Gets all existing permissions for the given dashboard.
[**PostDashboardPermissions**](DashboardPermissionsApi.md#PostDashboardPermissions) | **Post** /dashboards/id/{DashboardID}/permissions | Updates permissions for a dashboard.


# **GetDashboardPermissions**
> []models.DashboardAclInfoDTO GetDashboardPermissions(ctx, dashboardID)
Gets all existing permissions for the given dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 

### Return type

[**[]models.DashboardAclInfoDTO**](models.DashboardAclInfoDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostDashboardPermissions**
> SuccessResponseBody PostDashboardPermissions(ctx, body, dashboardID)
Updates permissions for a dashboard.

This operation will remove existing permissions if they’re not included in the request.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateDashboardAclCommand**](UpdateDashboardAclCommand.md)|  | 
  **dashboardID** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

