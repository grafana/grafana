# \RecordingRulesApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateRecordingRule**](RecordingRulesApi.md#CreateRecordingRule) | **Post** /recording-rules | Create a new recording rule.
[**CreateRecordingRuleWriteTarget**](RecordingRulesApi.md#CreateRecordingRuleWriteTarget) | **Post** /recording-rules/writer | Create a new write target.
[**DeleteRecordingRule**](RecordingRulesApi.md#DeleteRecordingRule) | **Delete** /recording-rules/{recordingRuleID} | Delete a recording rule.
[**DeleteRecordingRuleWriteTarget**](RecordingRulesApi.md#DeleteRecordingRuleWriteTarget) | **Delete** /recording-rules/writer | Delete the write target.
[**GetRecordingRuleWriteTarget**](RecordingRulesApi.md#GetRecordingRuleWriteTarget) | **Get** /recording-rules/writer | Get the write target.
[**ListRecordingRules**](RecordingRulesApi.md#ListRecordingRules) | **Get** /recording-rules | Get all recording rules.
[**TestCreateRecordingRule**](RecordingRulesApi.md#TestCreateRecordingRule) | **Post** /recording-rules/test | Test a recording rule.
[**UpdateRecordingRule**](RecordingRulesApi.md#UpdateRecordingRule) | **Put** /recording-rules | Update a recording rule.


# **CreateRecordingRule**
> RecordingRuleJson CreateRecordingRule(ctx, body)
Create a new recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**RecordingRuleJson**](RecordingRuleJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateRecordingRuleWriteTarget**
> PrometheusRemoteWriteTargetJson CreateRecordingRuleWriteTarget(ctx, body)
Create a new write target.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJson.md)|  | 

### Return type

[**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteRecordingRule**
> SuccessResponseBody DeleteRecordingRule(ctx, recordingRuleID)
Delete a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recordingRuleID** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteRecordingRuleWriteTarget**
> SuccessResponseBody DeleteRecordingRuleWriteTarget(ctx, )
Delete the write target.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetRecordingRuleWriteTarget**
> PrometheusRemoteWriteTargetJson GetRecordingRuleWriteTarget(ctx, )
Get the write target.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ListRecordingRules**
> []RecordingRuleJson ListRecordingRules(ctx, )
Get all recording rules.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]RecordingRuleJson**](RecordingRuleJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **TestCreateRecordingRule**
> SuccessResponseBody TestCreateRecordingRule(ctx, body)
Test a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateRecordingRule**
> RecordingRuleJson UpdateRecordingRule(ctx, body)
Update a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**RecordingRuleJson**](RecordingRuleJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

