# \DsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**QueryMetricsWithExpressions**](DsApi.md#QueryMetricsWithExpressions) | **Post** /ds/query | Query metrics with expressions


# **QueryMetricsWithExpressions**
> QueryDataResponse QueryMetricsWithExpressions(ctx, body)
Query metrics with expressions

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `datasources:query`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**MetricRequest**](MetricRequest.md)|  | 

### Return type

[**QueryDataResponse**](QueryDataResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

