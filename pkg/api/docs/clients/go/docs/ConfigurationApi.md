# \ConfigurationApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RouteDeleteNGalertConfig**](ConfigurationApi.md#RouteDeleteNGalertConfig) | **Delete** /v1/ngalert/admin_config | Deletes the NGalert configuration of the user&#39;s organization.
[**RouteGetAlertmanagers**](ConfigurationApi.md#RouteGetAlertmanagers) | **Get** /v1/ngalert/alertmanagers | Get the discovered and dropped Alertmanagers of the user&#39;s organization based on the specified configuration.
[**RouteGetNGalertConfig**](ConfigurationApi.md#RouteGetNGalertConfig) | **Get** /v1/ngalert/admin_config | Get the NGalert configuration of the user&#39;s organization, returns 404 if no configuration is present.
[**RoutePostNGalertConfig**](ConfigurationApi.md#RoutePostNGalertConfig) | **Post** /v1/ngalert/admin_config | Creates or updates the NGalert configuration of the user&#39;s organization. If no value is sent for alertmanagersChoice, it defaults to \&quot;all\&quot;.


# **RouteDeleteNGalertConfig**
> Ack RouteDeleteNGalertConfig(ctx, )
Deletes the NGalert configuration of the user's organization.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetAlertmanagers**
> GettableAlertmanagers RouteGetAlertmanagers(ctx, )
Get the discovered and dropped Alertmanagers of the user's organization based on the specified configuration.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**GettableAlertmanagers**](GettableAlertmanagers.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetNGalertConfig**
> GettableNGalertConfig RouteGetNGalertConfig(ctx, )
Get the NGalert configuration of the user's organization, returns 404 if no configuration is present.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**GettableNGalertConfig**](GettableNGalertConfig.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostNGalertConfig**
> Ack RoutePostNGalertConfig(ctx, optional)
Creates or updates the NGalert configuration of the user's organization. If no value is sent for alertmanagersChoice, it defaults to \"all\".

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***ConfigurationApiRoutePostNGalertConfigOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a ConfigurationApiRoutePostNGalertConfigOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of PostableNGalertConfig**](PostableNGalertConfig.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

