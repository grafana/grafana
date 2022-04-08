# \ApiKeysApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddAPIkey**](ApiKeysApi.md#AddAPIkey) | **Post** /auth/keys | Creates an API key.
[**DeleteAPIkey**](ApiKeysApi.md#DeleteAPIkey) | **Delete** /auth/keys/{id} | Delete API key.
[**GetAPIkeys**](ApiKeysApi.md#GetAPIkeys) | **Get** /auth/keys | Get auth keys.


# **AddAPIkey**
> dtos.NewApiKeyResult AddAPIkey(ctx, body)
Creates an API key.

Will return details of the created API key

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.AddApiKeyCommand**](models.AddApiKeyCommand.md)|  | 

### Return type

[**dtos.NewApiKeyResult**](dtos.NewApiKeyResult.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteAPIkey**
> SuccessResponseBody DeleteAPIkey(ctx, id)
Delete API key.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **id** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAPIkeys**
> []models.ApiKeyDTO GetAPIkeys(ctx, optional)
Get auth keys.

Will return auth keys.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***ApiKeysApiGetAPIkeysOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a ApiKeysApiGetAPIkeysOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **includeExpired** | **optional.Bool**| Show expired keys | [default to false]

### Return type

[**[]models.ApiKeyDTO**](models.ApiKeyDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

