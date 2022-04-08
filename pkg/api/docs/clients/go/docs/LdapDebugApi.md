# \LdapDebugApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**GetLDAPSyncStatus**](LdapDebugApi.md#GetLDAPSyncStatus) | **Get** /admin/ldap-sync-status | Available to grafana admins.


# **GetLDAPSyncStatus**
> ActiveSyncStatusDto GetLDAPSyncStatus(ctx, )
Available to grafana admins.

You need to have a permission with action `ldap.status:read`.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**ActiveSyncStatusDto**](ActiveSyncStatusDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

