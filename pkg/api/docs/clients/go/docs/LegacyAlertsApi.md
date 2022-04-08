# \LegacyAlertsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetAlertByID**](LegacyAlertsApi.md#GetAlertByID) | **Get** /alerts/{alert_id} | Get alert by ID.
[**GetAlerts**](LegacyAlertsApi.md#GetAlerts) | **Get** /alerts | Get legacy alerts.
[**GetDashboardStates**](LegacyAlertsApi.md#GetDashboardStates) | **Get** /alerts/states-for-dashboard | Get alert states for a dashboard.
[**PauseAlert**](LegacyAlertsApi.md#PauseAlert) | **Post** /alerts/{alert_id}/pause | Pause/unpause alert by id.
[**TestAlert**](LegacyAlertsApi.md#TestAlert) | **Post** /alerts/test | Test alert.


# **GetAlertByID**
> []Alert GetAlertByID(ctx, alertId)
Get alert by ID.

“evalMatches” data in the response is cached in the db when and only when the state of the alert changes (e.g. transitioning from “ok” to “alerting” state). If data from one server triggers the alert first and, before that server is seen leaving alerting state, a second server also enters a state that would trigger the alert, the second server will not be visible in “evalMatches” data.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **alertId** | **string**|  | 

### Return type

[**[]Alert**](Alert.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAlerts**
> []AlertListItemDto GetAlerts(ctx, optional)
Get legacy alerts.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***LegacyAlertsApiGetAlertsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a LegacyAlertsApiGetAlertsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **dashboardId** | [**optional.Interface of []string**](string.md)| Limit response to alerts in specified dashboard(s). You can specify multiple dashboards. | 
 **panelId** | **optional.Int64**| Limit response to alert for a specified panel on a dashboard. | 
 **query** | **optional.String**| Limit response to alerts having a name like this value. | 
 **state** | **optional.String**| Return alerts with one or more of the following alert states | 
 **limit** | **optional.Int64**| Limit response to X number of alerts. | 
 **folderId** | [**optional.Interface of []string**](string.md)| Limit response to alerts of dashboards in specified folder(s). You can specify multiple folders | 
 **dashboardQuery** | **optional.String**| Limit response to alerts having a dashboard name like this value./ Limit response to alerts having a dashboard name like this value. | 
 **dashboardTag** | [**optional.Interface of []string**](string.md)| Limit response to alerts of dashboards with specified tags. To do an “AND” filtering with multiple tags, specify the tags parameter multiple times | 

### Return type

[**[]AlertListItemDto**](AlertListItemDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetDashboardStates**
> []AlertStateInfoDto GetDashboardStates(ctx, dashboardId)
Get alert states for a dashboard.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardId** | **int64**|  | 

### Return type

[**[]AlertStateInfoDto**](AlertStateInfoDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PauseAlert**
> InlineResponse2002 PauseAlert(ctx, alertId, body)
Pause/unpause alert by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **alertId** | **string**|  | 
  **body** | [**PauseAlertCommand**](PauseAlertCommand.md)|  | 

### Return type

[**InlineResponse2002**](inline_response_200_2.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **TestAlert**
> AlertTestResult TestAlert(ctx, optional)
Test alert.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***LegacyAlertsApiTestAlertOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a LegacyAlertsApiTestAlertOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of AlertTestCommand**](AlertTestCommand.md)|  | 

### Return type

[**AlertTestResult**](AlertTestResult.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

