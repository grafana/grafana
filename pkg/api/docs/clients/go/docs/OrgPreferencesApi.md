# \OrgPreferencesApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetOrgPreferences**](OrgPreferencesApi.md#GetOrgPreferences) | **Get** /org/preferences | Get Current Org Prefs.
[**PatchOrgPreferences**](OrgPreferencesApi.md#PatchOrgPreferences) | **Patch** /org/preferences | Patch Current Org Prefs.
[**UpdateOrgPreferences**](OrgPreferencesApi.md#UpdateOrgPreferences) | **Put** /org/preferences | Update Current Org Prefs.


# **GetOrgPreferences**
> dtos.Prefs GetOrgPreferences(ctx, )
Get Current Org Prefs.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**dtos.Prefs**](dtos.Prefs.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PatchOrgPreferences**
> InlineResponse20010 PatchOrgPreferences(ctx, body)
Patch Current Org Prefs.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PatchPrefsCmd**](PatchPrefsCmd.md)|  | 

### Return type

[**InlineResponse20010**](inline_response_200_10.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateOrgPreferences**
> InlineResponse20010 UpdateOrgPreferences(ctx, body)
Update Current Org Prefs.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdatePrefsCmd**](UpdatePrefsCmd.md)|  | 

### Return type

[**InlineResponse20010**](inline_response_200_10.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

