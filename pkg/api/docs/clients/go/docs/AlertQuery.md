# AlertQuery

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**DatasourceUid** | **string** | Grafana data source unique identifier; it should be &#39;-100&#39; for a Server Side Expression operation. | [optional] [default to null]
**Model** | **interface{}** | JSON is the raw JSON query and includes the above properties as well as custom properties. | [optional] [default to null]
**QueryType** | **string** | QueryType is an optional identifier for the type of query. It can be used to distinguish different types of queries. | [optional] [default to null]
**RefId** | **string** | RefID is the unique identifier of the query, set by the frontend call. | [optional] [default to null]
**RelativeTimeRange** | [***RelativeTimeRange**](RelativeTimeRange.md) |  | [optional] [default to null]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


