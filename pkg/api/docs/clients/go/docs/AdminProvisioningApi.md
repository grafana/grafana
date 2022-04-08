# \AdminProvisioningApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ReloadProvisionedAccessControl**](AdminProvisioningApi.md#ReloadProvisionedAccessControl) | **Post** /admin/provisioning/accesscontrol/reload | Reload access control provisioning configurations.
[**ReloadProvisionedAlertNotifiers**](AdminProvisioningApi.md#ReloadProvisionedAlertNotifiers) | **Post** /admin/provisioning/notifications/reload | Reload legacy alert notifier provisioning configurations.
[**ReloadProvisionedDashboards**](AdminProvisioningApi.md#ReloadProvisionedDashboards) | **Post** /admin/provisioning/dashboards/reload | Reload dashboard provisioning configurations.
[**ReloadProvisionedDatasources**](AdminProvisioningApi.md#ReloadProvisionedDatasources) | **Post** /admin/provisioning/datasources/reload | Reload datasource provisioning configurations.
[**ReloadProvisionedPlugins**](AdminProvisioningApi.md#ReloadProvisionedPlugins) | **Post** /admin/provisioning/plugins/reload | Reload plugin provisioning configurations.


# **ReloadProvisionedAccessControl**
> SuccessResponseBody ReloadProvisionedAccessControl(ctx, )
Reload access control provisioning configurations.

Reloads the provisioning config files for access control again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:accesscontrol`.

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

# **ReloadProvisionedAlertNotifiers**
> SuccessResponseBody ReloadProvisionedAlertNotifiers(ctx, )
Reload legacy alert notifier provisioning configurations.

Reloads the provisioning config files for legacy alert notifiers again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:notifications`.

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

# **ReloadProvisionedDashboards**
> SuccessResponseBody ReloadProvisionedDashboards(ctx, )
Reload dashboard provisioning configurations.

Reloads the provisioning config files for dashboards again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:dashboards`.

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

# **ReloadProvisionedDatasources**
> SuccessResponseBody ReloadProvisionedDatasources(ctx, )
Reload datasource provisioning configurations.

Reloads the provisioning config files for datasources again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:datasources`.

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

# **ReloadProvisionedPlugins**
> SuccessResponseBody ReloadProvisionedPlugins(ctx, )
Reload plugin provisioning configurations.

Reloads the provisioning config files for plugins again. It won’t return until the new provisioned entities are already stored in the database. In case of dashboards, it will stop polling for changes in dashboard files and then restart it with new configurations after returning. If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `provisioning:reload` and scope `provisioners:plugin`.

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

