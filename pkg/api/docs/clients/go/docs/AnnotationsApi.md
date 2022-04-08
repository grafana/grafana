# \AnnotationsApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**CreateAnnotation**](AnnotationsApi.md#CreateAnnotation) | **Post** /annotations | Create Annotation.
[**CreateGraphiteAnnotation**](AnnotationsApi.md#CreateGraphiteAnnotation) | **Post** /annotations/graphite | Create Annotation in Graphite format.
[**DeleteAnnotation**](AnnotationsApi.md#DeleteAnnotation) | **Delete** /annotations/{annotation_id} | Delete Annotation By ID.
[**GetAnnotationTags**](AnnotationsApi.md#GetAnnotationTags) | **Get** /annotations/tags | Find Annotations Tags.
[**GetAnnotations**](AnnotationsApi.md#GetAnnotations) | **Get** /annotations | Find Annotations.
[**MassDeleteAnnotations**](AnnotationsApi.md#MassDeleteAnnotations) | **Post** /annotations/mass-delete | Delete multiple annotations.
[**PatchAnnotation**](AnnotationsApi.md#PatchAnnotation) | **Patch** /annotations/{annotation_id} | Patch Annotation
[**UpdateAnnotation**](AnnotationsApi.md#UpdateAnnotation) | **Put** /annotations/{annotation_id} | Update Annotation.


# **CreateAnnotation**
> InlineResponse2003 CreateAnnotation(ctx, body)
Create Annotation.

Creates an annotation in the Grafana database. The dashboardId and panelId fields are optional. If they are not specified then an organization annotation is created and can be queried in any dashboard that adds the Grafana annotations data source. When creating a region annotation include the timeEnd property. The format for `time` and `timeEnd` should be epoch numbers in millisecond resolution. The response for this HTTP request is slightly different in versions prior to v6.4. In prior versions you would also get an endId if you where creating a region. But in 6.4 regions are represented using a single event with time and timeEnd properties.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PostAnnotationsCmd**](PostAnnotationsCmd.md)|  | 

### Return type

[**InlineResponse2003**](inline_response_200_3.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **CreateGraphiteAnnotation**
> InlineResponse2003 CreateGraphiteAnnotation(ctx, body)
Create Annotation in Graphite format.

Creates an annotation by using Graphite-compatible event format. The `when` and `data` fields are optional. If `when` is not specified then the current time will be used as annotation’s timestamp. The `tags` field can also be in prior to Graphite `0.10.0` format (string with multiple tags being separated by a space).

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**PostGraphiteAnnotationsCmd**](PostGraphiteAnnotationsCmd.md)|  | 

### Return type

[**InlineResponse2003**](inline_response_200_3.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **DeleteAnnotation**
> SuccessResponseBody DeleteAnnotation(ctx, annotationId)
Delete Annotation By ID.

Deletes the annotation that matches the specified ID.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **annotationId** | **string**|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAnnotationTags**
> GetAnnotationTagsResponse GetAnnotationTags(ctx, optional)
Find Annotations Tags.

Find all the event tags created in the annotations.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AnnotationsApiGetAnnotationTagsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AnnotationsApiGetAnnotationTagsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **tag** | **optional.String**| Tag is a string that you can use to filter tags. | 
 **limit** | **optional.String**| Max limit for results returned. | [default to 100]

### Return type

[**GetAnnotationTagsResponse**](GetAnnotationTagsResponse.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **GetAnnotations**
> []ItemDto GetAnnotations(ctx, optional)
Find Annotations.

Starting in Grafana v6.4 regions annotations are now returned in one entity that now includes the timeEnd property.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AnnotationsApiGetAnnotationsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AnnotationsApiGetAnnotationsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **from** | **optional.Int64**| Find annotations created after specific epoch datetime in milliseconds. | 
 **to** | **optional.Int64**| Find annotations created before specific epoch datetime in milliseconds. | 
 **userId** | **optional.Int64**| Limit response to annotations created by specific user. | 
 **alertId** | **optional.Int64**| Find annotations for a specified alert. | 
 **dashboardId** | **optional.Int64**| Find annotations that are scoped to a specific dashboard | 
 **panelId** | **optional.Int64**| Find annotations that are scoped to a specific panel | 
 **limit** | **optional.Int64**| Max limit for results returned. | 
 **tags** | [**optional.Interface of []string**](string.md)| Use this to filter organization annotations. Organization annotations are annotations from an annotation data source that are not connected specifically to a dashboard or panel. You can filter by multiple tags. | 
 **type_** | **optional.String**| Return alerts or user created annotations | 
 **matchAny** | **optional.Bool**| Match any or all tags | 

### Return type

[**[]ItemDto**](ItemDTO.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **MassDeleteAnnotations**
> SuccessResponseBody MassDeleteAnnotations(ctx, body)
Delete multiple annotations.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **body** | [**DeleteAnnotationsCmd**](DeleteAnnotationsCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **PatchAnnotation**
> SuccessResponseBody PatchAnnotation(ctx, annotationId, body)
Patch Annotation

Updates one or more properties of an annotation that matches the specified ID. This operation currently supports updating of the `text`, `tags`, `time` and `timeEnd` properties. This is available in Grafana 6.0.0-beta2 and above.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **annotationId** | **string**|  | 
  **body** | [**PatchAnnotationsCmd**](PatchAnnotationsCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **UpdateAnnotation**
> SuccessResponseBody UpdateAnnotation(ctx, annotationId, body)
Update Annotation.

Updates all properties of an annotation that matches the specified id. To only update certain property, consider using the Patch Annotation operation.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **annotationId** | **string**|  | 
  **body** | [**UpdateAnnotationsCmd**](UpdateAnnotationsCmd.md)|  | 

### Return type

[**SuccessResponseBody**](SuccessResponseBody.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

