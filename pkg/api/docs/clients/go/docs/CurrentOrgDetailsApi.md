# \CurrentOrgDetailsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddOrgUser**](CurrentOrgDetailsApi.md#AddOrgUser) | **Post** /org/users | Add a new user to the current organization
[**DeleteOrgUser**](CurrentOrgDetailsApi.md#DeleteOrgUser) | **Delete** /org/users/{user_id} | Delete user in current organization
[**GetOrg**](CurrentOrgDetailsApi.md#GetOrg) | **Get** /org | 
[**GetOrgUsers**](CurrentOrgDetailsApi.md#GetOrgUsers) | **Get** /org/users | Get all users within the current organization.
[**LookupOrgUsers**](CurrentOrgDetailsApi.md#LookupOrgUsers) | **Get** /org/users/lookup | Get all users within the current organization (lookup)
[**UpdateOrg**](CurrentOrgDetailsApi.md#UpdateOrg) | **Put** /org | Update current Organization.
[**UpdateOrgAddress**](CurrentOrgDetailsApi.md#UpdateOrgAddress) | **Put** /org/address | Update current Organization&#39;s address.
[**UpdateOrgUser**](CurrentOrgDetailsApi.md#UpdateOrgUser) | **Patch** /org/users/{user_id} | Updates the given user


# **AddOrgUser**
> SuccessResponseBody AddOrgUser(ctx, body)
Add a new user to the current organization

Adds a global user to the current organization.  If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:add` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AddOrgUserCommand**](AddOrgUserCommand.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteOrgUser**
> SuccessResponseBody DeleteOrgUser(ctx, userId)
Delete user in current organization

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:remove` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetOrg**
> OrgDetailsDto GetOrg(ctx, )


Get current Organization

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**OrgDetailsDto**](OrgDetailsDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetOrgUsers**
> []OrgUserDto GetOrgUsers(ctx, )
Get all users within the current organization.

Returns all org users within the current organization. Accessible to users with org admin role. If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:read` with scope `users:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]OrgUserDto**](OrgUserDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **LookupOrgUsers**
> []UserLookupDto LookupOrgUsers(ctx, optional)
Get all users within the current organization (lookup)

Returns all org users within the current organization, but with less detailed information. Accessible to users with org admin role, admin in any folder or admin of any team. Mainly used by Grafana UI for providing list of users when adding team members and when editing folder/dashboard permissions.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***CurrentOrgDetailsApiLookupOrgUsersOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a CurrentOrgDetailsApiLookupOrgUsersOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **query** | **optional.String**|  | 
 **limit** | **optional.Int64**|  | 

### Return type

[**[]UserLookupDto**](UserLookupDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateOrg**
> SuccessResponseBody UpdateOrg(ctx, body)
Update current Organization.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgForm**](UpdateOrgForm.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateOrgAddress**
> SuccessResponseBody UpdateOrgAddress(ctx, body)
Update current Organization's address.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgAddressForm**](UpdateOrgAddressForm.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateOrgUser**
> SuccessResponseBody UpdateOrgUser(ctx, body, userId)
Updates the given user

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users.role:update` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgUserCommand**](UpdateOrgUserCommand.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

