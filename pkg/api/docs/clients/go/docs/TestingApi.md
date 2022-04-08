# \TestingApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RouteEvalQueries**](TestingApi.md#RouteEvalQueries) | **Post** /v1/eval | 
[**RouteTestRuleConfig**](TestingApi.md#RouteTestRuleConfig) | **Post** /v1/rule/test/{Recipient} | 
[**RouteTestRuleGrafanaConfig**](TestingApi.md#RouteTestRuleGrafanaConfig) | **Post** /v1/rule/test/grafana | 


# **RouteEvalQueries**
> EvalQueriesResponse RouteEvalQueries(ctx, optional)


Test rule

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***TestingApiRouteEvalQueriesOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a TestingApiRouteEvalQueriesOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of EvalQueriesPayload**](EvalQueriesPayload.md)|  | 

### Return type

[**EvalQueriesResponse**](EvalQueriesResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteTestRuleConfig**
> TestRuleResponse RouteTestRuleConfig(ctx, recipient, optional)


Test a rule against external data source ruler

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***TestingApiRouteTestRuleConfigOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a TestingApiRouteTestRuleConfigOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **body** | [**optional.Interface of TestRulePayload**](TestRulePayload.md)|  | 

### Return type

[**TestRuleResponse**](TestRuleResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteTestRuleGrafanaConfig**
> TestRuleResponse RouteTestRuleGrafanaConfig(ctx, optional)


Test a rule against Grafana ruler

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***TestingApiRouteTestRuleGrafanaConfigOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a TestingApiRouteTestRuleGrafanaConfigOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of TestRulePayload**](TestRulePayload.md)|  | 

### Return type

[**TestRuleResponse**](TestRuleResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

