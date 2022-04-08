# \TeamsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddTeamMember**](TeamsApi.md#AddTeamMember) | **Post** /teams/{team_id}/members | Add Team Member.
[**CreateTeam**](TeamsApi.md#CreateTeam) | **Post** /teams | Add Team.
[**DeleteTeamByID**](TeamsApi.md#DeleteTeamByID) | **Delete** /teams/{team_id} | Delete Team By ID.
[**GetTeam**](TeamsApi.md#GetTeam) | **Get** /teams/{team_id} | Get Team By ID.
[**GetTeamMembers**](TeamsApi.md#GetTeamMembers) | **Get** /teams/{team_id}/members | Get Team Members.
[**GetTeamPreferences**](TeamsApi.md#GetTeamPreferences) | **Get** /teams/{team_id}/preferences | Get Team Preferences.
[**RemoveTeamMember**](TeamsApi.md#RemoveTeamMember) | **Delete** /teams/{team_id}/members/{user_id} | Remove Member From Team.
[**SearchTeams**](TeamsApi.md#SearchTeams) | **Get** /teams/search | Team Search With Paging.
[**UpdateTeam**](TeamsApi.md#UpdateTeam) | **Put** /teams/{team_id} | Update Team.
[**UpdateTeamMember**](TeamsApi.md#UpdateTeamMember) | **Put** /teams/{team_id}/members/{user_id} | Update Team Member.
[**UpdateTeamPreferences**](TeamsApi.md#UpdateTeamPreferences) | **Put** /teams/{team_id}/preferences | Update Team Preferences.


# **AddTeamMember**
> SuccessResponseBody AddTeamMember(ctx, teamId)
Add Team Member.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateTeam**
> InlineResponse20015 CreateTeam(ctx, body)
Add Team.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateTeamCommand**](CreateTeamCommand.md)|  | 

### Return type

[**InlineResponse20015**](inline_response_200_15.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteTeamByID**
> SuccessResponseBody DeleteTeamByID(ctx, teamId)
Delete Team By ID.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetTeam**
> models.TeamDTO GetTeam(ctx, teamId)
Get Team By ID.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 

### Return type

[**models.TeamDTO**](models.TeamDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetTeamMembers**
> SuccessResponseBody GetTeamMembers(ctx, teamId)
Get Team Members.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetTeamPreferences**
> dtos.Prefs GetTeamPreferences(ctx, teamId)
Get Team Preferences.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 

### Return type

[**dtos.Prefs**](dtos.Prefs.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RemoveTeamMember**
> SuccessResponseBody RemoveTeamMember(ctx, teamId, userId)
Remove Member From Team.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SearchTeams**
> SearchTeamQueryResult SearchTeams(ctx, optional)
Team Search With Paging.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***TeamsApiSearchTeamsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a TeamsApiSearchTeamsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **optional.Int64**|  | [default to 1]
 **perpage** | **optional.Int64**| Number of items per page The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams. | [default to 1000]
 **name** | **optional.String**|  | 
 **query** | **optional.String**| If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded. | 

### Return type

[**SearchTeamQueryResult**](SearchTeamQueryResult.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateTeam**
> SuccessResponseBody UpdateTeam(ctx, teamId, body)
Update Team.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 
  **body** | [**UpdateTeamCommand**](UpdateTeamCommand.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateTeamMember**
> SuccessResponseBody UpdateTeamMember(ctx, teamId, body, userId)
Update Team Member.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 
  **body** | [**UpdateTeamMemberCommand**](UpdateTeamMemberCommand.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateTeamPreferences**
> SuccessResponseBody UpdateTeamPreferences(ctx, teamId, body)
Update Team Preferences.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **string**|  | 
  **body** | [**UpdatePrefsCmd**](UpdatePrefsCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

