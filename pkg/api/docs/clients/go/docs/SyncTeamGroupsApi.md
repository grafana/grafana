# \SyncTeamGroupsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddTeamGroupApi**](SyncTeamGroupsApi.md#AddTeamGroupApi) | **Post** /teams/{teamId}/groups | Add External Group.
[**GetTeamGroupsApi**](SyncTeamGroupsApi.md#GetTeamGroupsApi) | **Get** /teams/{teamId}/groups | Get External Groups.
[**RemoveTeamGroupApi**](SyncTeamGroupsApi.md#RemoveTeamGroupApi) | **Delete** /teams/{teamId}/groups/{groupId} | Remove External Group.


# **AddTeamGroupApi**
> SuccessResponseBody AddTeamGroupApi(ctx, body, teamId)
Add External Group.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**TeamGroupMapping**](TeamGroupMapping.md)|  | 
  **teamId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetTeamGroupsApi**
> []TeamGroupDto GetTeamGroupsApi(ctx, teamId)
Get External Groups.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **int64**|  | 

### Return type

[**[]TeamGroupDto**](TeamGroupDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RemoveTeamGroupApi**
> SuccessResponseBody RemoveTeamGroupApi(ctx, groupId, teamId)
Remove External Group.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **groupId** | **int64**|  | 
  **teamId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

