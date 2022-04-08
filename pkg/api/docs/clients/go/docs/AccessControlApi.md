# \AccessControlApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddBuiltinRole**](AccessControlApi.md#AddBuiltinRole) | **Post** /access-control/builtin-roles | Create a built-in role assignment.
[**AddTeamRole**](AccessControlApi.md#AddTeamRole) | **Post** /access-control/teams/{teamId}/roles | Add team role.
[**AddUserRole**](AccessControlApi.md#AddUserRole) | **Post** /access-control/users/{user_id}/roles | Add a user role assignment.
[**CreateRoleWithPermissions**](AccessControlApi.md#CreateRoleWithPermissions) | **Post** /access-control/roles | Create a new custom role.
[**DeleteCustomRole**](AccessControlApi.md#DeleteCustomRole) | **Delete** /access-control/roles/{roleUID} | Delete a custom role.
[**GetAccessControlStatus**](AccessControlApi.md#GetAccessControlStatus) | **Get** /access-control/status | Get status.
[**GetAllRoles**](AccessControlApi.md#GetAllRoles) | **Get** /access-control/roles | Get all roles.
[**GetRole**](AccessControlApi.md#GetRole) | **Get** /access-control/roles/{roleUID} | Get a role.
[**ListBuiltinRoles**](AccessControlApi.md#ListBuiltinRoles) | **Get** /access-control/builtin-roles | Get all built-in role assignments.
[**ListTeamRoles**](AccessControlApi.md#ListTeamRoles) | **Get** /access-control/teams/{teamId}/roles | Get team roles.
[**ListUserRoles**](AccessControlApi.md#ListUserRoles) | **Get** /access-control/users/{user_id}/roles | List roles assigned to a user.
[**RemoveBuiltinRole**](AccessControlApi.md#RemoveBuiltinRole) | **Delete** /access-control/builtin-roles/{builtinRole}/roles/{roleUID} | Remove a built-in role assignment.
[**RemoveTeamRole**](AccessControlApi.md#RemoveTeamRole) | **Delete** /access-control/teams/{teamId}/roles/{roleUID} | Remove team role.
[**RemoveUserRole**](AccessControlApi.md#RemoveUserRole) | **Delete** /access-control/users/{user_id}/roles/{roleUID} | Remove a user role assignment.
[**SetTeamRoles**](AccessControlApi.md#SetTeamRoles) | **Put** /access-control/teams/{teamId}/roles | Update team role.
[**SetUserRoles**](AccessControlApi.md#SetUserRoles) | **Put** /access-control/users/{user_id}/roles | Set user role assignments.
[**UpdateRoleWithPermissions**](AccessControlApi.md#UpdateRoleWithPermissions) | **Put** /access-control/roles/{roleUID} | Update a custom role.


# **AddBuiltinRole**
> SuccessResponseBody AddBuiltinRole(ctx, body)
Create a built-in role assignment.

You need to have a permission with action `roles.builtin:add` and scope `permissions:delegate`. `permission:delegate` scope ensures that users can only create built-in role assignments with the roles which have same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to create a built-in role assignment which will allow to do that. This is done to prevent escalation of privileges.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AddBuiltInRoleCommand**](AddBuiltInRoleCommand.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AddTeamRole**
> SuccessResponseBody AddTeamRole(ctx, teamId, body)
Add team role.

You need to have a permission with action `teams.roles:add` and scope `permissions:delegate`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **int64**|  | 
  **body** | [**AddTeamRoleCommand**](AddTeamRoleCommand.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AddUserRole**
> SuccessResponseBody AddUserRole(ctx, body, userId)
Add a user role assignment.

Assign a role to a specific user. For bulk updates consider Set user role assignments.  You need to have a permission with action `users.roles:add` and scope `permissions:delegate`. `permission:delegate` scope ensures that users can only assign roles which have same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to assign a role which will allow to do that. This is done to prevent escalation of privileges.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AddUserRoleCommand**](AddUserRoleCommand.md)|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateRoleWithPermissions**
> RoleDto CreateRoleWithPermissions(ctx, body)
Create a new custom role.

Creates a new custom role and maps given permissions to that role. Note that roles with the same prefix as Fixed Roles can’t be created.  You need to have a permission with action `roles:write` and scope `permissions:delegate`. `permission:delegate`` scope ensures that users can only create custom roles with the same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to create a custom role which allows to do that. This is done to prevent escalation of privileges.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**SetUserRolesCommand**](SetUserRolesCommand.md)|  | 

### Return type

[**RoleDto**](RoleDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteCustomRole**
> SuccessResponseBody DeleteCustomRole(ctx, roleUID)
Delete a custom role.

Delete a role with the given UID, and it’s permissions. If the role is assigned to a built-in role, the deletion operation will fail, unless force query param is set to true, and in that case all assignments will also be deleted.  You need to have a permission with action `roles:delete` and scope `permissions:delegate`. `permission:delegate` scope ensures that users can only delete a custom role with the same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to delete a custom role which allows to do that.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAccessControlStatus**
> Status GetAccessControlStatus(ctx, )
Get status.

Returns an indicator to check if fine-grained access control is enabled or not.  You need to have a permission with action `status:accesscontrol` and scope `services:accesscontrol`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**Status**](Status.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAllRoles**
> []RoleDto GetAllRoles(ctx, )
Get all roles.

Gets all existing roles. The response contains all global and organization local roles, for the organization which user is signed in.  You need to have a permission with action `roles:list` and scope `roles:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]RoleDto**](RoleDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetRole**
> RoleDto GetRole(ctx, roleUID)
Get a role.

Get a role for the given UID.  You need to have a permission with action `roles:read` and scope `roles:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 

### Return type

[**RoleDto**](RoleDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ListBuiltinRoles**
> map[string][]RoleDto ListBuiltinRoles(ctx, )
Get all built-in role assignments.

You need to have a permission with action `roles.builtin:list` with scope `roles:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**map[string][]RoleDto**](array.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ListTeamRoles**
> SuccessResponseBody ListTeamRoles(ctx, teamId)
Get team roles.

You need to have a permission with action `teams.roles:list` and scope `teams:id:<team ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ListUserRoles**
> []RoleDto ListUserRoles(ctx, userId)
List roles assigned to a user.

Lists the roles that have been directly assigned to a given user. The list does not include built-in roles (Viewer, Editor, Admin or Grafana Admin), and it does not include roles that have been inherited from a team.  You need to have a permission with action `users.roles:list` and scope `users:id:<user ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userId** | **int64**|  | 

### Return type

[**[]RoleDto**](RoleDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RemoveBuiltinRole**
> SuccessResponseBody RemoveBuiltinRole(ctx, roleUID, builtinRole, optional)
Remove a built-in role assignment.

Deletes a built-in role assignment (for one of Viewer, Editor, Admin, or Grafana Admin) to the role with the provided UID.  You need to have a permission with action `roles.builtin:remove` and scope `permissions:delegate`. `permission:delegate` scope ensures that users can only remove built-in role assignments with the roles which have same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to remove a built-in role assignment which allows to do that.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 
  **builtinRole** | **string**|  | 
 **optional** | ***AccessControlApiRemoveBuiltinRoleOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AccessControlApiRemoveBuiltinRoleOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **global** | **optional.Bool**| A flag indicating if the assignment is global or not. If set to false, the default org ID of the authenticated user will be used from the request to remove assignment. | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RemoveTeamRole**
> SuccessResponseBody RemoveTeamRole(ctx, roleUID, teamId)
Remove team role.

You need to have a permission with action `teams.roles:remove` and scope `permissions:delegate`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 
  **teamId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RemoveUserRole**
> SuccessResponseBody RemoveUserRole(ctx, roleUID, userId, optional)
Remove a user role assignment.

Revoke a role from a user. For bulk updates consider Set user role assignments.  You need to have a permission with action `users.roles:remove` and scope `permissions:delegate`. `permission:delegate` scope ensures that users can only unassign roles which have same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to unassign a role which will allow to do that. This is done to prevent escalation of privileges.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 
  **userId** | **int64**|  | 
 **optional** | ***AccessControlApiRemoveUserRoleOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AccessControlApiRemoveUserRoleOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------


 **global** | **optional.Bool**| A flag indicating if the assignment is global or not. If set to false, the default org ID of the authenticated user will be used from the request to remove assignment. | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SetTeamRoles**
> SuccessResponseBody SetTeamRoles(ctx, teamId)
Update team role.

You need to have a permission with action `teams.roles:add` and `teams.roles:remove` and scope `permissions:delegate` for each.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **teamId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SetUserRoles**
> SuccessResponseBody SetUserRoles(ctx, userId)
Set user role assignments.

Update the user’s role assignments to match the provided set of UIDs. This will remove any assigned roles that aren’t in the request and add roles that are in the set but are not already assigned to the user. If you want to add or remove a single role, consider using Add a user role assignment or Remove a user role assignment instead.  You need to have a permission with action `users.roles:add` and `users.roles:remove` and scope `permissions:delegate` for each. `permission:delegate`  scope ensures that users can only assign or unassign roles which have same, or a subset of permissions which the user has. For example, if a user does not have required permissions for creating users, they won’t be able to assign or unassign a role which will allow to do that. This is done to prevent escalation of privileges.

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

# **UpdateRoleWithPermissions**
> RoleDto UpdateRoleWithPermissions(ctx, roleUID, body)
Update a custom role.

You need to have a permission with action `roles:write` and scope `permissions:delegate`. `permission:delegate`` scope ensures that users can only create custom roles with the same, or a subset of permissions which the user has.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **roleUID** | **string**|  | 
  **body** | [**UpdateRoleCommand**](UpdateRoleCommand.md)|  | 

### Return type

[**RoleDto**](RoleDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

