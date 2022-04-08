# \PrometheusApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RouteGetAlertStatuses**](PrometheusApi.md#RouteGetAlertStatuses) | **Get** /prometheus/{Recipient}/api/v1/alerts | 
[**RouteGetGrafanaAlertStatuses**](PrometheusApi.md#RouteGetGrafanaAlertStatuses) | **Get** /prometheus/grafana/api/v1/alerts | 
[**RouteGetGrafanaRuleStatuses**](PrometheusApi.md#RouteGetGrafanaRuleStatuses) | **Get** /prometheus/grafana/api/v1/rules | 
[**RouteGetRuleStatuses**](PrometheusApi.md#RouteGetRuleStatuses) | **Get** /prometheus/{Recipient}/api/v1/rules | 


# **RouteGetAlertStatuses**
> AlertResponse RouteGetAlertStatuses(ctx, recipient)


gets the current alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**AlertResponse**](AlertResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaAlertStatuses**
> AlertResponse RouteGetGrafanaAlertStatuses(ctx, optional)


gets the current alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***PrometheusApiRouteGetGrafanaAlertStatusesOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a PrometheusApiRouteGetGrafanaAlertStatusesOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **includeInternalLabels** | **optional.Bool**| Include Grafana specific labels as part of the response. | [default to false]

### Return type

[**AlertResponse**](AlertResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaRuleStatuses**
> RuleResponse RouteGetGrafanaRuleStatuses(ctx, optional)


gets the evaluation statuses of all rules

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***PrometheusApiRouteGetGrafanaRuleStatusesOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a PrometheusApiRouteGetGrafanaRuleStatusesOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **includeInternalLabels** | **optional.Bool**| Include Grafana specific labels as part of the response. | [default to false]
 **dashboardUID** | **optional.String**| Filter the list of rules to those that belong to the specified dashboard UID. | 
 **panelID** | **optional.Int64**| Filter the list of rules to those that belong to the specified panel ID. Dashboard UID must be specified. | 

### Return type

[**RuleResponse**](RuleResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetRuleStatuses**
> RuleResponse RouteGetRuleStatuses(ctx, recipient)


gets the evaluation statuses of all rules

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**RuleResponse**](RuleResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

