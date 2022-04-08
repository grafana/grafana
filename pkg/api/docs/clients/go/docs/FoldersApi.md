# \FoldersApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateFolder**](FoldersApi.md#CreateFolder) | **Post** /folders | Create folder.
[**DeleteFolder**](FoldersApi.md#DeleteFolder) | **Delete** /folders/{folder_uid} | Delete folder.
[**GetFolderByID**](FoldersApi.md#GetFolderByID) | **Get** /folders/id/{folder_id} | Get folder by id.
[**GetFolderByUID**](FoldersApi.md#GetFolderByUID) | **Get** /folders/{folder_uid} | Get folder by uid.
[**GetFolders**](FoldersApi.md#GetFolders) | **Get** /folders | Get all folders.
[**UpdateFolder**](FoldersApi.md#UpdateFolder) | **Put** /folders/{folder_uid} | Update folder.


# **CreateFolder**
> dtos.Folder CreateFolder(ctx, body)
Create folder.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**models.CreateFolderCommand**](models.CreateFolderCommand.md)|  | 

### Return type

[**dtos.Folder**](dtos.Folder.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteFolder**
> InlineResponse2009 DeleteFolder(ctx, folderUid, optional)
Delete folder.

Deletes an existing folder identified by UID along with all dashboards (and their alerts) stored in the folder. This operation cannot be reverted.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **folderUid** | **string**|  | 
 **optional** | ***FoldersApiDeleteFolderOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a FoldersApiDeleteFolderOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **forceDeleteRules** | **optional.Bool**| If &#x60;true&#x60; any Grafana 8 Alerts under this folder will be deleted. Set to &#x60;false&#x60; so that the request will fail if the folder contains any Grafana 8 Alerts. | [default to false]

### Return type

[**InlineResponse2009**](inline_response_200_9.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetFolderByID**
> dtos.Folder GetFolderByID(ctx, folderId)
Get folder by id.

Returns the folder identified by id.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **folderId** | **int64**|  | 

### Return type

[**dtos.Folder**](dtos.Folder.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetFolderByUID**
> GetFolderByUID(ctx, folderUid)
Get folder by uid.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **folderUid** | **string**|  | 

### Return type

 (empty response body)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetFolders**
> []dtos.FolderSearchHit GetFolders(ctx, optional)
Get all folders.

Returns all folders that the authenticated user has permission to view.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***FoldersApiGetFoldersOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a FoldersApiGetFoldersOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **optional.Int64**| Limit the maximum number of folders to return | [default to 1000]
 **page** | **optional.Int64**| Page index for starting fetching folders | [default to 1]

### Return type

[**[]dtos.FolderSearchHit**](dtos.FolderSearchHit.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateFolder**
> dtos.Folder UpdateFolder(ctx, folderUid, body)
Update folder.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **folderUid** | **string**|  | 
  **body** | [**models.UpdateFolderCommand**](models.UpdateFolderCommand.md)| To change the unique identifier (uid), provide another one. To overwrite an existing folder with newer version, set &#x60;overwrite&#x60; to &#x60;true&#x60;. Provide the current version to safelly update the folder: if the provided version differs from the stored one the request will fail, unless &#x60;overwrite&#x60; is &#x60;true&#x60;. | 

### Return type

[**dtos.Folder**](dtos.Folder.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

