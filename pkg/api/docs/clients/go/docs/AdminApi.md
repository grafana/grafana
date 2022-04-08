# \AdminApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetSettings**](AdminApi.md#GetSettings) | **Get** /admin/settings | Fetch settings.
[**GetStats**](AdminApi.md#GetStats) | **Get** /admin/stats | Fetch Grafana Stats.
[**PauseAllAlerts**](AdminApi.md#PauseAllAlerts) | **Post** /admin/pause-all-alerts | Pause/unpause all (legacy) alerts.


# **GetSettings**
> SettingsBag GetSettings(ctx, )
Fetch settings.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `settings:read` and scopes: `settings:*`, `settings:auth.saml:` and `settings:auth.saml:enabled` (property level).

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SettingsBag**](SettingsBag.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetStats**
> AdminStats GetStats(ctx, )
Fetch Grafana Stats.

Only works with Basic Authentication (username and password). See introduction for an explanation. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `server:stats:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**AdminStats**](AdminStats.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PauseAllAlerts**
> InlineResponse200 PauseAllAlerts(ctx, body)
Pause/unpause all (legacy) alerts.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PauseAllAlertsCommand**](PauseAllAlertsCommand.md)|  | 

### Return type

[**InlineResponse200**](inline_response_200.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

