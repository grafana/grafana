# \SnapshotsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateSnapshot**](SnapshotsApi.md#CreateSnapshot) | **Post** /snapshots | When creating a snapshot using the API, you have to provide the full dashboard payload including the snapshot data. This endpoint is designed for the Grafana UI.
[**DeleteSnapshotByDeleteKey**](SnapshotsApi.md#DeleteSnapshotByDeleteKey) | **Get** /snapshots-delete/{deleteKey} | Delete Snapshot by deleteKey.
[**DeleteSnapshotByKey**](SnapshotsApi.md#DeleteSnapshotByKey) | **Delete** /snapshots/{key} | Delete Snapshot by Key.
[**GetSnapshotByKey**](SnapshotsApi.md#GetSnapshotByKey) | **Get** /snapshots/{key} | Get Snapshot by Key.
[**GetSnapshotSharingOptions**](SnapshotsApi.md#GetSnapshotSharingOptions) | **Get** /snapshot/shared-options | Get snapshot sharing settings.
[**GetSnapshots**](SnapshotsApi.md#GetSnapshots) | **Get** /dashboard/snapshots | List snapshots.


# **CreateSnapshot**
> InlineResponse20014 CreateSnapshot(ctx, body)
When creating a snapshot using the API, you have to provide the full dashboard payload including the snapshot data. This endpoint is designed for the Grafana UI.

Snapshot public mode should be enabled or authentication is required.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.CreateDashboardSnapshotCommand**](models.CreateDashboardSnapshotCommand.md)|  | 

### Return type

[**InlineResponse20014**](inline_response_200_14.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteSnapshotByDeleteKey**
> SuccessResponseBody DeleteSnapshotByDeleteKey(ctx, deleteKey)
Delete Snapshot by deleteKey.

Snapshot public mode should be enabled or authentication is required.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **deleteKey** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteSnapshotByKey**
> SuccessResponseBody DeleteSnapshotByKey(ctx, key)
Delete Snapshot by Key.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **key** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetSnapshotByKey**
> GetSnapshotByKey(ctx, key)
Get Snapshot by Key.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **key** | **string**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetSnapshotSharingOptions**
> InlineResponse20013 GetSnapshotSharingOptions(ctx, )
Get snapshot sharing settings.

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**InlineResponse20013**](inline_response_200_13.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetSnapshots**
> []models.DashboardSnapshotDTO GetSnapshots(ctx, optional)
List snapshots.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***SnapshotsApiGetSnapshotsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a SnapshotsApiGetSnapshotsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **query** | **optional.String**| Search Query | 
 **limit** | **optional.Int64**| Limit the number of returned results | [default to 1000]

### Return type

[**[]models.DashboardSnapshotDTO**](models.DashboardSnapshotDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

