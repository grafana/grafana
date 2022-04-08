# \SamlApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetSAMLLogin**](SamlApi.md#GetSAMLLogin) | **Get** /login/saml | It initiates the login flow by redirecting the user to the IdP.
[**GetSAMLLogout**](SamlApi.md#GetSAMLLogout) | **Get** /logout/saml | GetLogout initiates single logout process.
[**GetSAMLMetadata**](SamlApi.md#GetSAMLMetadata) | **Get** /saml/metadata | It exposes the SP (Grafana&#39;s) metadata for the IdP&#39;s consumption.
[**PostACS**](SamlApi.md#PostACS) | **Post** /saml/acs | It performs assertion Consumer Service (ACS).
[**PostSLO**](SamlApi.md#PostSLO) | **Post** /saml/slo | It performs Single Logout (SLO) callback.


# **GetSAMLLogin**
> GetSAMLLogin(ctx, )
It initiates the login flow by redirecting the user to the IdP.

### Required Parameters
This endpoint does not need any parameter.

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetSAMLLogout**
> GetSAMLLogout(ctx, )
GetLogout initiates single logout process.

### Required Parameters
This endpoint does not need any parameter.

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetSAMLMetadata**
> []int32 GetSAMLMetadata(ctx, )
It exposes the SP (Grafana's) metadata for the IdP's consumption.

### Required Parameters
This endpoint does not need any parameter.

### Return type

**[]int32**

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/xml;application/samlmetadata+xml

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostACS**
> PostACS(ctx, optional)
It performs assertion Consumer Service (ACS).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***SamlApiPostACSOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a SamlApiPostACSOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **relayState** | **optional.String**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostSLO**
> PostSLO(ctx, optional)
It performs Single Logout (SLO) callback.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***SamlApiPostSLOOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a SamlApiPostSLOOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **sAMLRequest** | **optional.String**|  | 
 **sAMLResponse** | **optional.String**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

