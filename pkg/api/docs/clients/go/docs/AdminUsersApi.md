# \AdminUsersApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateUser**](AdminUsersApi.md#CreateUser) | **Post** /admin/users | Create new user.
[**DeleteUser**](AdminUsersApi.md#DeleteUser) | **Delete** /admin/users/{user_id} | Delete global User.
[**DisableUser**](AdminUsersApi.md#DisableUser) | **Post** /admin/users/{user_id}/disable | Disable user.
[**EnableUser**](AdminUsersApi.md#EnableUser) | **Post** /admin/users/{user_id}/enable | Enable user.
[**GetAuthTokens**](AdminUsersApi.md#GetAuthTokens) | **Get** /admin/users/{user_id}/auth-tokens | Return a list of all auth tokens (devices) that the user currently have logged in from.
[**GetUserQuota**](AdminUsersApi.md#GetUserQuota) | **Get** /admin/users/{user_id}/quotas | Fetch user quota.
[**LogoutUser**](AdminUsersApi.md#LogoutUser) | **Post** /admin/users/{user_id}/logout | Logout user revokes all auth tokens (devices) for the user. User of issued auth tokens (devices) will no longer be logged in and will be required to authenticate again upon next activity.
[**RevokeAuthToken**](AdminUsersApi.md#RevokeAuthToken) | **Post** /admin/users/{user_id}/revoke-auth-token | Revoke auth token for user.
[**SetPassword**](AdminUsersApi.md#SetPassword) | **Put** /admin/users/{user_id}/password | Set password for user.
[**SetPermissions**](AdminUsersApi.md#SetPermissions) | **Put** /admin/users/{user_id}/permissions | Set permissions for user.
[**UpdateUserQuota**](AdminUsersApi.md#UpdateUserQuota) | **Put** /admin/users/{user_id}/quotas/{quota_target} | Update user quota.


# **CreateUser**
> UserIdDto CreateUser(ctx, body)
Create new user.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:create`. Note that OrgId is an optional parameter that can be used to assign a new user to a different organization when `auto_assign_org` is set to `true`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AdminCreateUserForm**](AdminCreateUserForm.md)|  | 

### Return type

[**UserIdDto**](UserIdDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteUser**
> SuccessResponseBody DeleteUser(ctx, userId)
Delete global User.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:delete` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DisableUser**
> SuccessResponseBody DisableUser(ctx, userId)
Disable user.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:disable` and scope `global:users:1` (userIDScope).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **EnableUser**
> SuccessResponseBody EnableUser(ctx, userId)
Enable user.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users:enable` and scope `global:users:1` (userIDScope).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAuthTokens**
> []UserToken GetAuthTokens(ctx, userId)
Return a list of all auth tokens (devices) that the user currently have logged in from.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.authtoken:list` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**[]UserToken**](UserToken.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetUserQuota**
> []UserQuotaDto GetUserQuota(ctx, userId)
Fetch user quota.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:list` and scope `global:users:1` (userIDScope).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**[]UserQuotaDto**](UserQuotaDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **LogoutUser**
> SuccessResponseBody LogoutUser(ctx, userId)
Logout user revokes all auth tokens (devices) for the user. User of issued auth tokens (devices) will no longer be logged in and will be required to authenticate again upon next activity.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.logout` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RevokeAuthToken**
> SuccessResponseBody RevokeAuthToken(ctx, body, userId)
Revoke auth token for user.

Revokes the given auth token (device) for the user. User of issued auth token (device) will no longer be logged in and will be required to authenticate again upon next activity. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.authtoken:update` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RevokeAuthTokenCmd**](RevokeAuthTokenCmd.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SetPassword**
> SuccessResponseBody SetPassword(ctx, body, userId)
Set password for user.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.password:update` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AdminUpdateUserPasswordForm**](AdminUpdateUserPasswordForm.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SetPermissions**
> SuccessResponseBody SetPermissions(ctx, body, userId)
Set permissions for user.

Only works with Basic Authentication (username and password). See introduction for an explanation. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.permissions:update` and scope `global:users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AdminUpdateUserPermissionsForm**](AdminUpdateUserPermissionsForm.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateUserQuota**
> SuccessResponseBody UpdateUserQuota(ctx, quotaTarget, body, userId)
Update user quota.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `users.quotas:update` and scope `global:users:1` (userIDScope).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **quotaTarget** | **string**|  | 
  **body** | [**UpdateUserQuotaCmd**](UpdateUserQuotaCmd.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

