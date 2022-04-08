# \UsersApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetUserByID**](UsersApi.md#GetUserByID) | **Get** /users/{user_id} | Get user by id.
[**GetUserByLoginOrEmail**](UsersApi.md#GetUserByLoginOrEmail) | **Get** /users/lookup | Get user by login or email.
[**GetUserOrgList**](UsersApi.md#GetUserOrgList) | **Get** /users/{user_id}/orgs | Get organizations for user.
[**GetUserTeams**](UsersApi.md#GetUserTeams) | **Get** /users/{user_id}/teams | Get teams for user.
[**SearchUsers**](UsersApi.md#SearchUsers) | **Get** /users | Get users.
[**SearchUsersWithPaging**](UsersApi.md#SearchUsersWithPaging) | **Get** /users/search | Get users with paging.
[**UpdateUser**](UsersApi.md#UpdateUser) | **Put** /users/{user_id} | Update user.


# **GetUserByID**
> UserProfileDto GetUserByID(ctx, userId)
Get user by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**UserProfileDto**](UserProfileDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetUserByLoginOrEmail**
> UserProfileDto GetUserByLoginOrEmail(ctx, loginOrEmail)
Get user by login or email.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **loginOrEmail** | **string**| loginOrEmail of the user | 

### Return type

[**UserProfileDto**](UserProfileDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetUserOrgList**
> []models.UserOrgDTO GetUserOrgList(ctx, userId)
Get organizations for user.

Get organizations for user identified by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**[]models.UserOrgDTO**](models.UserOrgDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetUserTeams**
> []models.TeamDTO GetUserTeams(ctx, userId)
Get teams for user.

Get teams for user identified by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**[]models.TeamDTO**](models.TeamDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SearchUsers**
> models.SearchUserQueryResult SearchUsers(ctx, optional)
Get users.

Returns all users that the authenticated user has permission to view, admin permission required.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***UsersApiSearchUsersOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a UsersApiSearchUsersOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **perpage** | **optional.Int64**| Limit the maximum number of users to return per page | [default to 1000]
 **page** | **optional.Int64**| Page index for starting fetching users | [default to 1]

### Return type

[**models.SearchUserQueryResult**](models.SearchUserQueryResult.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SearchUsersWithPaging**
> models.SearchUserQueryResult SearchUsersWithPaging(ctx, )
Get users with paging.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**models.SearchUserQueryResult**](models.SearchUserQueryResult.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateUser**
> UserProfileDto UpdateUser(ctx, userId, body)
Update user.

Update the user identified by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 
  **body** | [**models.UpdateUserCommand**](models.UpdateUserCommand.md)| To change the email, name, login, theme, provide another one. | 

### Return type

[**UserProfileDto**](UserProfileDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

