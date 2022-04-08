# \SearchApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**Search**](SearchApi.md#Search) | **Get** /search | 
[**SearchSorting**](SearchApi.md#SearchSorting) | **Get** /search/sorting | 


# **Search**
> HitList Search(ctx, optional)


### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***SearchApiSearchOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a SearchApiSearchOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **query** | **optional.String**| Search Query | 
 **tag** | [**optional.Interface of []string**](string.md)| List of tags to search for | 
 **type_** | **optional.String**| Type to search for, dash-folder or dash-db | 
 **dashboardIds** | [**optional.Interface of []int64**](int64.md)| List of dashboard id’s to search for | 
 **folderIds** | [**optional.Interface of []int64**](int64.md)| List of folder id’s to search in for dashboards | 
 **starred** | **optional.Bool**| Flag indicating if only starred Dashboards should be returned | 
 **limit** | **optional.Int64**| Limit the number of returned results (max 5000) | 
 **page** | **optional.Int64**| Use this parameter to access hits beyond limit. Numbering starts at 1. limit param acts as page size. Only available in Grafana v6.2+. | 
 **permission** | **optional.String**| Set to &#x60;Edit&#x60; to return dashboards/folders that the user can edit | [default to View]
 **sort** | **optional.String**| Sort method; for listing all the possible sort methods use the search sorting endpoint. | [default to alpha-asc]

### Return type

[**HitList**](HitList.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **SearchSorting**
> InlineResponse20012 SearchSorting(ctx, )


List search sorting options

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**InlineResponse20012**](inline_response_200_12.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

