# \OrgsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**AdminAddOrgUser**](OrgsApi.md#AdminAddOrgUser) | **Post** /orgs/{org_id}/users | Add a new user to the current organization
[**AdminDeleteOrg**](OrgsApi.md#AdminDeleteOrg) | **Delete** /orgs/{org_id} | Delete Organization.
[**AdminDeleteOrgUser**](OrgsApi.md#AdminDeleteOrgUser) | **Delete** /orgs/{org_id}/users/{user_id} | Delete user in current organization
[**AdminGetOrgUsers**](OrgsApi.md#AdminGetOrgUsers) | **Get** /orgs/{org_id}/users | Get Users in Organization.
[**AdminUpdateOrg**](OrgsApi.md#AdminUpdateOrg) | **Put** /orgs/{org_id} | Update Organization.
[**AdminUpdateOrgAddress**](OrgsApi.md#AdminUpdateOrgAddress) | **Put** /orgs/{org_id}/address | Update Organization&#39;s address.
[**AdminUpdateOrgUser**](OrgsApi.md#AdminUpdateOrgUser) | **Patch** /orgs/{org_id}/users/{user_id} | Update Users in Organization.
[**CreateOrg**](OrgsApi.md#CreateOrg) | **Post** /orgs | Create Organization.
[**GetOrgByID**](OrgsApi.md#GetOrgByID) | **Get** /orgs/{org_id} | Get Organization by ID.
[**GetOrgByName**](OrgsApi.md#GetOrgByName) | **Get** /orgs/name/{org_name} | Get Organization by ID.
[**GetOrgQuota**](OrgsApi.md#GetOrgQuota) | **Get** /orgs/{org_id}/quotas | Fetch Organization quota.
[**SearchOrg**](OrgsApi.md#SearchOrg) | **Get** /orgs | 
[**UpdateOrgQuota**](OrgsApi.md#UpdateOrgQuota) | **Put** /orgs/{org_id}/quotas/{quota_target} | Update user quota.


# **AdminAddOrgUser**
> SuccessResponseBody AdminAddOrgUser(ctx, body, orgId)
Add a new user to the current organization

Adds a global user to the current organization.  If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:add` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**AddOrgUserCommand**](AddOrgUserCommand.md)|  | 
  **orgId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminDeleteOrg**
> SuccessResponseBody AdminDeleteOrg(ctx, orgId)
Delete Organization.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminDeleteOrgUser**
> SuccessResponseBody AdminDeleteOrgUser(ctx, orgId, userId)
Delete user in current organization

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:remove` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgId** | **int64**|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminGetOrgUsers**
> []OrgUserDto AdminGetOrgUsers(ctx, orgId)
Get Users in Organization.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users:read` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgId** | **int64**|  | 

### Return type

[**[]OrgUserDto**](OrgUserDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminUpdateOrg**
> SuccessResponseBody AdminUpdateOrg(ctx, body, orgId)
Update Organization.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgForm**](UpdateOrgForm.md)|  | 
  **orgId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminUpdateOrgAddress**
> SuccessResponseBody AdminUpdateOrgAddress(ctx, body, orgId)
Update Organization's address.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgAddressForm**](UpdateOrgAddressForm.md)|  | 
  **orgId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **AdminUpdateOrgUser**
> SuccessResponseBody AdminUpdateOrgUser(ctx, body, orgId, userId)
Update Users in Organization.

If you are running Grafana Enterprise and have Fine-grained access control enabled you need to have a permission with action: `org.users.role:update` with scope `users:*`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**UpdateOrgUserCommand**](UpdateOrgUserCommand.md)|  | 
  **orgId** | **int64**|  | 
  **userId** | **int64**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateOrg**
> InlineResponse20011 CreateOrg(ctx, body)
Create Organization.

Only works if [users.allow_org_create](https://grafana.com/docs/grafana/latest/administration/configuration/#allow_org_create) is set.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**CreateOrgCommand**](CreateOrgCommand.md)|  | 

### Return type

[**InlineResponse20011**](inline_response_200_11.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetOrgByID**
> OrgDetailsDto GetOrgByID(ctx, orgId)
Get Organization by ID.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgId** | **int64**|  | 

### Return type

[**OrgDetailsDto**](OrgDetailsDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetOrgByName**
> OrgDetailsDto GetOrgByName(ctx, orgName)
Get Organization by ID.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgName** | **string**|  | 

### Return type

[**OrgDetailsDto**](OrgDetailsDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetOrgQuota**
> []UserQuotaDto GetOrgQuota(ctx, orgId)
Fetch Organization quota.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:read` and scope `org:id:1` (orgIDScope). list

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **orgId** | **int64**|  | 

### Return type

[**[]UserQuotaDto**](UserQuotaDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SearchOrg**
> []OrgDto SearchOrg(ctx, optional)


Search all Organizations

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***OrgsApiSearchOrgOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a OrgsApiSearchOrgOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **page** | **optional.Int64**|  | [default to 1]
 **perpage** | **optional.Int64**| Number of items per page The totalCount field in the response can be used for pagination list E.g. if totalCount is equal to 100 teams and the perpage parameter is set to 10 then there are 10 pages of teams. | [default to 1000]
 **name** | **optional.String**|  | 
 **query** | **optional.String**| If set it will return results where the query value is contained in the name field. Query values with spaces need to be URL encoded. | 

### Return type

[**[]OrgDto**](OrgDTO.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateOrgQuota**
> SuccessResponseBody UpdateOrgQuota(ctx, quotaTarget, orgId, body)
Update user quota.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `orgs.quotas:write` and scope `org:id:1` (orgIDScope).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **quotaTarget** | **string**|  | 
  **orgId** | **int64**|  | 
  **body** | [**UpdateOrgQuotaCmd**](UpdateOrgQuotaCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

