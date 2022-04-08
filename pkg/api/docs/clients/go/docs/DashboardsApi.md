# \DashboardsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CalcDashboardDiff**](DashboardsApi.md#CalcDashboardDiff) | **Post** /dashboards/calculate-diff | Perform diff on two dashboards.
[**DeleteDashboardByUID**](DashboardsApi.md#DeleteDashboardByUID) | **Delete** /dashboards/uid/{uid} | Delete dashboard by uid.
[**GetDashboardByUID**](DashboardsApi.md#GetDashboardByUID) | **Get** /dashboards/uid/{uid} | Get dashboard by uid.
[**GetDashboardTags**](DashboardsApi.md#GetDashboardTags) | **Get** /dashboards/tags | Get all dashboards tags of an organisation.
[**GetHomeDashboard**](DashboardsApi.md#GetHomeDashboard) | **Get** /dashboards/home | Get home dashboard.
[**ImportDashboard**](DashboardsApi.md#ImportDashboard) | **Post** /dashboards/import | Import dashboard.
[**PostDashboard**](DashboardsApi.md#PostDashboard) | **Post** /dashboards/db | Create / Update dashboard
[**TrimDashboard**](DashboardsApi.md#TrimDashboard) | **Post** /dashboards/trim | Trim defaults from dashboard.


# **CalcDashboardDiff**
> []int32 CalcDashboardDiff(ctx, body)
Perform diff on two dashboards.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**Body**](Body.md)|  | 

### Return type

**[]int32**

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json, text/html

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteDashboardByUID**
> InlineResponse2005 DeleteDashboardByUID(ctx, uid)
Delete dashboard by uid.

Will delete the dashboard given the specified unique identifier (uid).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **uid** | **string**|  | 

### Return type

[**InlineResponse2005**](inline_response_200_5.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDashboardByUID**
> dtos.DashboardFullWithMeta GetDashboardByUID(ctx, uid)
Get dashboard by uid.

Will return the dashboard given the dashboard unique identifier (uid).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **uid** | **string**|  | 

### Return type

[**dtos.DashboardFullWithMeta**](dtos.DashboardFullWithMeta.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDashboardTags**
> []models.DashboardTagCloudItem GetDashboardTags(ctx, )
Get all dashboards tags of an organisation.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]models.DashboardTagCloudItem**](models.DashboardTagCloudItem.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetHomeDashboard**
> GetHomeDashboardResponse GetHomeDashboard(ctx, )
Get home dashboard.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**GetHomeDashboardResponse**](GetHomeDashboardResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ImportDashboard**
> ImportDashboardResponse ImportDashboard(ctx, body)
Import dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**ImportDashboardRequest**](ImportDashboardRequest.md)|  | 

### Return type

[**ImportDashboardResponse**](ImportDashboardResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostDashboard**
> InlineResponse2004 PostDashboard(ctx, body)
Create / Update dashboard

Creates a new dashboard or updates an existing dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.SaveDashboardCommand**](models.SaveDashboardCommand.md)|  | 

### Return type

[**InlineResponse2004**](inline_response_200_4.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **TrimDashboard**
> dtos.TrimDashboardFullWithMeta TrimDashboard(ctx, body)
Trim defaults from dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.TrimDashboardCommand**](models.TrimDashboardCommand.md)|  | 

### Return type

[**dtos.TrimDashboardFullWithMeta**](dtos.TrimDashboardFullWithMeta.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

