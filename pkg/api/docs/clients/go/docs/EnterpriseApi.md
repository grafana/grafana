# \EnterpriseApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AddBuiltinRole**](EnterpriseApi.md#AddBuiltinRole) | **Post** /access-control/builtin-roles | Create a built-in role assignment.
[**AddTeamGroupApi**](EnterpriseApi.md#AddTeamGroupApi) | **Post** /teams/{teamId}/groups | Add External Group.
[**AddTeamRole**](EnterpriseApi.md#AddTeamRole) | **Post** /access-control/teams/{teamId}/roles | Add team role.
[**AddUserRole**](EnterpriseApi.md#AddUserRole) | **Post** /access-control/users/{user_id}/roles | Add a user role assignment.
[**AdminProvisioningReloadAccessControl**](EnterpriseApi.md#AdminProvisioningReloadAccessControl) | **Post** /admin/provisioning/access-control/reload | You need to have a permission with action &#x60;provisioning:reload&#x60; with scope &#x60;provisioners:accesscontrol&#x60;.
[**CreateRecordingRule**](EnterpriseApi.md#CreateRecordingRule) | **Post** /recording-rules | Create a new recording rule.
[**CreateRecordingRuleWriteTarget**](EnterpriseApi.md#CreateRecordingRuleWriteTarget) | **Post** /recording-rules/writer | Create a new write target.
[**CreateReport**](EnterpriseApi.md#CreateReport) | **Post** /reports | Create a report.
[**CreateRoleWithPermissions**](EnterpriseApi.md#CreateRoleWithPermissions) | **Post** /access-control/roles | Create a new custom role.
[**DeleteCustomRole**](EnterpriseApi.md#DeleteCustomRole) | **Delete** /access-control/roles/{roleUID} | Delete a custom role.
[**DeleteLicenseToken**](EnterpriseApi.md#DeleteLicenseToken) | **Delete** /licensing/token | Remove license from database.
[**DeletePermissions**](EnterpriseApi.md#DeletePermissions) | **Delete** /datasources/{datasource_id}/permissions/{permissionId} | Remove permission for a data source.
[**DeleteRecordingRule**](EnterpriseApi.md#DeleteRecordingRule) | **Delete** /recording-rules/{recordingRuleID} | Delete a recording rule.
[**DeleteRecordingRuleWriteTarget**](EnterpriseApi.md#DeleteRecordingRuleWriteTarget) | **Delete** /recording-rules/writer | Delete the write target.
[**DeleteReport**](EnterpriseApi.md#DeleteReport) | **Delete** /reports/{reportID} | Delete a report.
[**DisablePermissions**](EnterpriseApi.md#DisablePermissions) | **Post** /datasources/{datasource_id}/disable-permissions | Disable permissions for a data source.
[**EnablePermissions**](EnterpriseApi.md#EnablePermissions) | **Post** /datasources/{datasource_id}/enable-permissions | Enable permissions for a data source.
[**GetAccessControlStatus**](EnterpriseApi.md#GetAccessControlStatus) | **Get** /access-control/status | Get status.
[**GetAllRoles**](EnterpriseApi.md#GetAllRoles) | **Get** /access-control/roles | Get all roles.
[**GetCustomPermissionsCSV**](EnterpriseApi.md#GetCustomPermissionsCSV) | **Get** /licensing/custom-permissions-csv | Get custom permissions report in CSV format.
[**GetCustomPermissionsReport**](EnterpriseApi.md#GetCustomPermissionsReport) | **Get** /licensing/custom-permissions | Get custom permissions report.
[**GetLicenseStatus**](EnterpriseApi.md#GetLicenseStatus) | **Get** /licensing/check | Check license availability.
[**GetLicenseToken**](EnterpriseApi.md#GetLicenseToken) | **Get** /licensing/token | Get license token.
[**GetPermissions**](EnterpriseApi.md#GetPermissions) | **Get** /datasources/{datasource_id}/permissions | Get permissions for a data source.
[**GetRecordingRuleWriteTarget**](EnterpriseApi.md#GetRecordingRuleWriteTarget) | **Get** /recording-rules/writer | Get the write target.
[**GetReport**](EnterpriseApi.md#GetReport) | **Get** /reports/{reportID} | Get a report.
[**GetReportSettings**](EnterpriseApi.md#GetReportSettings) | **Get** /reports/settings | Get settings.
[**GetReports**](EnterpriseApi.md#GetReports) | **Get** /reports | List reports.
[**GetRole**](EnterpriseApi.md#GetRole) | **Get** /access-control/roles/{roleUID} | Get a role.
[**GetSAMLLogin**](EnterpriseApi.md#GetSAMLLogin) | **Get** /login/saml | It initiates the login flow by redirecting the user to the IdP.
[**GetSAMLLogout**](EnterpriseApi.md#GetSAMLLogout) | **Get** /logout/saml | GetLogout initiates single logout process.
[**GetSAMLMetadata**](EnterpriseApi.md#GetSAMLMetadata) | **Get** /saml/metadata | It exposes the SP (Grafana&#39;s) metadata for the IdP&#39;s consumption.
[**GetTeamGroupsApi**](EnterpriseApi.md#GetTeamGroupsApi) | **Get** /teams/{teamId}/groups | Get External Groups.
[**ListBuiltinRoles**](EnterpriseApi.md#ListBuiltinRoles) | **Get** /access-control/builtin-roles | Get all built-in role assignments.
[**ListRecordingRules**](EnterpriseApi.md#ListRecordingRules) | **Get** /recording-rules | Get all recording rules.
[**ListTeamRoles**](EnterpriseApi.md#ListTeamRoles) | **Get** /access-control/teams/{teamId}/roles | Get team roles.
[**ListUserRoles**](EnterpriseApi.md#ListUserRoles) | **Get** /access-control/users/{user_id}/roles | List roles assigned to a user.
[**PostACS**](EnterpriseApi.md#PostACS) | **Post** /saml/acs | It performs assertion Consumer Service (ACS).
[**PostLicenseToken**](EnterpriseApi.md#PostLicenseToken) | **Post** /licensing/token | Create license token.
[**PostRenewLicenseToken**](EnterpriseApi.md#PostRenewLicenseToken) | **Post** /licensing/token/renew | Manually force license refresh.
[**PostSLO**](EnterpriseApi.md#PostSLO) | **Post** /saml/slo | It performs Single Logout (SLO) callback.
[**RefreshLicenseStats**](EnterpriseApi.md#RefreshLicenseStats) | **Get** /licensing/refresh-stats | Refresh license stats.
[**RemoveBuiltinRole**](EnterpriseApi.md#RemoveBuiltinRole) | **Delete** /access-control/builtin-roles/{builtinRole}/roles/{roleUID} | Remove a built-in role assignment.
[**RemoveTeamGroupApi**](EnterpriseApi.md#RemoveTeamGroupApi) | **Delete** /teams/{teamId}/groups/{groupId} | Remove External Group.
[**RemoveTeamRole**](EnterpriseApi.md#RemoveTeamRole) | **Delete** /access-control/teams/{teamId}/roles/{roleUID} | Remove team role.
[**RemoveUserRole**](EnterpriseApi.md#RemoveUserRole) | **Delete** /access-control/users/{user_id}/roles/{roleUID} | Remove a user role assignment.
[**RenderReportPDF**](EnterpriseApi.md#RenderReportPDF) | **Get** /reports/render/pdf/{DashboardID} | Render report for dashboard.
[**SaveReportSettings**](EnterpriseApi.md#SaveReportSettings) | **Post** /reports/settings | Save settings.
[**SendReport**](EnterpriseApi.md#SendReport) | **Post** /reports/email | Send a report.
[**SendTestEmail**](EnterpriseApi.md#SendTestEmail) | **Post** /reports/test-email | Send test report via email.
[**SetTeamRoles**](EnterpriseApi.md#SetTeamRoles) | **Put** /access-control/teams/{teamId}/roles | Update team role.
[**SetUserRoles**](EnterpriseApi.md#SetUserRoles) | **Put** /access-control/users/{user_id}/roles | Set user role assignments.
[**TestCreateRecordingRule**](EnterpriseApi.md#TestCreateRecordingRule) | **Post** /recording-rules/test | Test a recording rule.
[**UpdateRecordingRule**](EnterpriseApi.md#UpdateRecordingRule) | **Put** /recording-rules | Update a recording rule.
[**UpdateReport**](EnterpriseApi.md#UpdateReport) | **Put** /reports/{reportID} | Update a report.
[**UpdateRoleWithPermissions**](EnterpriseApi.md#UpdateRoleWithPermissions) | **Put** /access-control/roles/{roleUID} | Update a custom role.


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

# **AdminProvisioningReloadAccessControl**
> ErrorResponseBody AdminProvisioningReloadAccessControl(ctx, )
You need to have a permission with action `provisioning:reload` with scope `provisioners:accesscontrol`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**ErrorResponseBody**](ErrorResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateRecordingRule**
> RecordingRuleJson CreateRecordingRule(ctx, body)
Create a new recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**RecordingRuleJson**](RecordingRuleJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateRecordingRuleWriteTarget**
> PrometheusRemoteWriteTargetJson CreateRecordingRuleWriteTarget(ctx, body)
Create a new write target.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJson.md)|  | 

### Return type

[**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateReport**
> interface{} CreateReport(ctx, body)
Create a report.

Available to org admins only and with a valid license.  You need to have a permission with action `reports.admin:create`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

### Return type

**interface{}**

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

# **DeleteLicenseToken**
> ErrorResponseBody DeleteLicenseToken(ctx, body)
Remove license from database.

Removes the license stored in the Grafana database. Available in Grafana Enterprise v7.4+.  You need to have a permission with action `licensing:delete`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**DeleteTokenCommand**](DeleteTokenCommand.md)|  | 

### Return type

[**ErrorResponseBody**](ErrorResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeletePermissions**
> SuccessResponseBody DeletePermissions(ctx, permissionId, datasourceId)
Remove permission for a data source.

Removes the permission with the given permissionId for the data source with the given id.  You need to have a permission with action `datasources.permissions:delete` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **permissionId** | **string**|  | 
  **datasourceId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteRecordingRule**
> SuccessResponseBody DeleteRecordingRule(ctx, recordingRuleID)
Delete a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recordingRuleID** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteRecordingRuleWriteTarget**
> SuccessResponseBody DeleteRecordingRuleWriteTarget(ctx, )
Delete the write target.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteReport**
> SuccessResponseBody DeleteReport(ctx, reportID)
Delete a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.delete` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DisablePermissions**
> InlineResponse2006 DisablePermissions(ctx, datasourceId)
Disable permissions for a data source.

Disables permissions for the data source with the given id. All existing permissions will be removed and anyone will be able to query the data source.  You need to have a permission with action `datasources.permissions:toggle` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **EnablePermissions**
> InlineResponse2006 EnablePermissions(ctx, datasourceId)
Enable permissions for a data source.

Enables permissions for the data source with the given id. No one except Org Admins will be able to query the data source until permissions have been added which permit certain users or teams to query the data source.  You need to have a permission with action `datasources.permissions:toggle` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**InlineResponse2006**](inline_response_200_6.md)

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

# **GetCustomPermissionsCSV**
> []CustomPermissionsRecordDto GetCustomPermissionsCSV(ctx, )
Get custom permissions report in CSV format.

You need to have a permission with action `licensing.reports:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]CustomPermissionsRecordDto**](CustomPermissionsRecordDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: text/csv

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetCustomPermissionsReport**
> []CustomPermissionsRecordDto GetCustomPermissionsReport(ctx, )
Get custom permissions report.

You need to have a permission with action `licensing.reports:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]CustomPermissionsRecordDto**](CustomPermissionsRecordDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetLicenseStatus**
> GetLicenseStatus(ctx, )
Check license availability.

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

# **GetLicenseToken**
> Token GetLicenseToken(ctx, )
Get license token.

You need to have a permission with action `licensing:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**Token**](Token.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetPermissions**
> AddPermissionDto GetPermissions(ctx, datasourceId)
Get permissions for a data source.

Gets all existing permissions for the data source with the given id.  You need to have a permission with action `datasources.permissions:read` and scopes `datasources:*`, `datasources:id:*`, `datasources:id:1` (single data source).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **datasourceId** | **string**|  | 

### Return type

[**AddPermissionDto**](AddPermissionDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetRecordingRuleWriteTarget**
> PrometheusRemoteWriteTargetJson GetRecordingRuleWriteTarget(ctx, )
Get the write target.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**PrometheusRemoteWriteTargetJson**](PrometheusRemoteWriteTargetJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReport**
> ConfigDto GetReport(ctx, reportID)
Get a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports:read` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 

### Return type

[**ConfigDto**](ConfigDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReportSettings**
> SettingsDto GetReportSettings(ctx, )
Get settings.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.settings:read`x.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SettingsDto**](SettingsDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetReports**
> []ConfigDto GetReports(ctx, )
List reports.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports:read` with scope `reports:*`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]ConfigDto**](ConfigDTO.md)

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

# **ListRecordingRules**
> []RecordingRuleJson ListRecordingRules(ctx, )
Get all recording rules.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**[]RecordingRuleJson**](RecordingRuleJSON.md)

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

# **PostACS**
> PostACS(ctx, optional)
It performs assertion Consumer Service (ACS).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***EnterpriseApiPostACSOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a EnterpriseApiPostACSOpts struct

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

# **PostLicenseToken**
> Token PostLicenseToken(ctx, body)
Create license token.

You need to have a permission with action `licensing:update`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**DeleteTokenCommand**](DeleteTokenCommand.md)|  | 

### Return type

[**Token**](Token.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PostRenewLicenseToken**
> PostRenewLicenseToken(ctx, body)
Manually force license refresh.

Manually ask license issuer for a new token. Available in Grafana Enterprise v7.4+.  You need to have a permission with action `licensing:update`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | **interface{}**|  | 

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
 **optional** | ***EnterpriseApiPostSLOOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a EnterpriseApiPostSLOOpts struct

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

# **RefreshLicenseStats**
> ActiveUserStats RefreshLicenseStats(ctx, )
Refresh license stats.

You need to have a permission with action `licensing:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**ActiveUserStats**](ActiveUserStats.md)

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
 **optional** | ***EnterpriseApiRemoveBuiltinRoleOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a EnterpriseApiRemoveBuiltinRoleOpts struct

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
 **optional** | ***EnterpriseApiRemoveUserRoleOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a EnterpriseApiRemoveUserRoleOpts struct

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

# **RenderReportPDF**
> []int32 RenderReportPDF(ctx, dashboardID)
Render report for dashboard.

Available to all users and with a valid license.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **dashboardID** | **int64**|  | 

### Return type

**[]int32**

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/pdf

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SaveReportSettings**
> SuccessResponseBody SaveReportSettings(ctx, body)
Save settings.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.settings:write`xx.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**SettingsDto**](SettingsDto.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SendReport**
> SuccessResponseBody SendReport(ctx, body)
Send a report.

Generate and send a report. This API waits for the report to be generated before returning. We recommend that you set the client’s timeout to at least 60 seconds. Available to org admins only and with a valid license.  Only available in Grafana Enterprise v7.0+. This API endpoint is experimental and may be deprecated in a future release. On deprecation, a migration strategy will be provided and the endpoint will remain functional until the next major release of Grafana.  You need to have a permission with action `reports:send`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**ReportEmailDto**](ReportEmailDto.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SendTestEmail**
> SuccessResponseBody SendTestEmail(ctx, body)
Send test report via email.

Available to org admins only and with a valid license.  You need to have a permission with action `reports:send`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

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

# **TestCreateRecordingRule**
> SuccessResponseBody TestCreateRecordingRule(ctx, body)
Test a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateRecordingRule**
> RecordingRuleJson UpdateRecordingRule(ctx, body)
Update a recording rule.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**RecordingRuleJson**](RecordingRuleJson.md)|  | 

### Return type

[**RecordingRuleJson**](RecordingRuleJSON.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateReport**
> SuccessResponseBody UpdateReport(ctx, reportID, body)
Update a report.

Available to org admins only and with a valid or expired license  You need to have a permission with action `reports.admin:write` with scope `reports:id:<report ID>`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **reportID** | **int64**|  | 
  **body** | [**CreateOrUpdateConfigCmd**](CreateOrUpdateConfigCmd.md)|  | 

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

