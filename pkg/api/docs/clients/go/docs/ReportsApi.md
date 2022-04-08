# \ReportsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateReport**](ReportsApi.md#CreateReport) | **Post** /reports | Create a report.
[**DeleteReport**](ReportsApi.md#DeleteReport) | **Delete** /reports/{reportID} | Delete a report.
[**GetReport**](ReportsApi.md#GetReport) | **Get** /reports/{reportID} | Get a report.
[**GetReportSettings**](ReportsApi.md#GetReportSettings) | **Get** /reports/settings | Get settings.
[**GetReports**](ReportsApi.md#GetReports) | **Get** /reports | List reports.
[**RenderReportPDF**](ReportsApi.md#RenderReportPDF) | **Get** /reports/render/pdf/{DashboardID} | Render report for dashboard.
[**SaveReportSettings**](ReportsApi.md#SaveReportSettings) | **Post** /reports/settings | Save settings.
[**SendReport**](ReportsApi.md#SendReport) | **Post** /reports/email | Send a report.
[**SendTestEmail**](ReportsApi.md#SendTestEmail) | **Post** /reports/test-email | Send test report via email.
[**UpdateReport**](ReportsApi.md#UpdateReport) | **Put** /reports/{reportID} | Update a report.


# **CreateReport**
> interface{} CreateReport(ctx, body)
Create a report.

Available to org admins only and with a valid license.  You need to have a permission with action `reports.admin:create`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

### Return type

**interface{}**

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteReport**
> SuccessResponseBody DeleteReport(ctx, reportID)
Delete a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.delete` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReport**
> ConfigDto GetReport(ctx, reportID)
Get a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports:read` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 

### Return type

[**ConfigDto**](ConfigDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReportSettings**
> SettingsDto GetReportSettings(ctx, )
Get settings.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.settings:read`x.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SettingsDto**](SettingsDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReports**
> []ConfigDto GetReports(ctx, )
List reports.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports:read` with scope `reports:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]ConfigDto**](ConfigDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RenderReportPDF**
> []int32 RenderReportPDF(ctx, dashboardID)
Render report for dashboard.

Available to all users and with a valid license.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 

### Return type

**[]int32**

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/pdf

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SaveReportSettings**
> SuccessResponseBody SaveReportSettings(ctx, body)
Save settings.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.settings:write`xx.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**SettingsDto**](SettingsDto.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SendReport**
> SuccessResponseBody SendReport(ctx, body)
Send a report.

Generate and send a report. This API waits for the report to be generated before returning. We recommend that you set the client’s timeout to at least 60 seconds. Available to org admins only and with a valid license.  Only available in Grafana Enterprise v7.0+. This API endpoint is experimental and may be deprecated in a future release. On deprecation, a migration strategy will be provided and the endpoint will remain functional until the next major release of Grafana.  You need to have a permission with action `reports:send`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**ReportEmailDto**](ReportEmailDto.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SendTestEmail**
> SuccessResponseBody SendTestEmail(ctx, body)
Send test report via email.

Available to org admins only and with a valid license.  You need to have a permission with action `reports:send`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateReport**
> SuccessResponseBody UpdateReport(ctx, reportID, body)
Update a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.admin:write` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

