# \AdminLdapApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetLDAPStatus**](AdminLdapApi.md#GetLDAPStatus) | **Get** /admin/ldap/status | Attempts to connect to all the configured LDAP servers and returns information on whenever they&#39;re available or not.
[**GetLDAPUser**](AdminLdapApi.md#GetLDAPUser) | **Get** /admin/ldap/{user_name} | Finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.
[**ReloadLDAP**](AdminLdapApi.md#ReloadLDAP) | **Post** /admin/ldap/reload | Reloads the LDAP configuration.
[**SyncLDAPUser**](AdminLdapApi.md#SyncLDAPUser) | **Post** /admin/ldap/sync/{user_id} | Enables a single Grafana user to be synchronized against LDAP.


# **GetLDAPStatus**
> SuccessResponseBody GetLDAPStatus(ctx, )
Attempts to connect to all the configured LDAP servers and returns information on whenever they're available or not.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.status:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetLDAPUser**
> SuccessResponseBody GetLDAPUser(ctx, userName)
Finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:read`.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **userName** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ReloadLDAP**
> SuccessResponseBody ReloadLDAP(ctx, )
Reloads the LDAP configuration.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.config:reload`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SyncLDAPUser**
> SuccessResponseBody SyncLDAPUser(ctx, userId)
Enables a single Grafana user to be synchronized against LDAP.

If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:sync`.

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

