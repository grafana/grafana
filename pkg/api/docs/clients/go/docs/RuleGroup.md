# RuleGroup

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**EvaluationTime** | **float64** |  | [optional] [default to null]
**File** | **string** |  | [default to null]
**Interval** | **float64** |  | [default to null]
**LastEvaluation** | [**time.Time**](time.Time.md) |  | [optional] [default to null]
**Name** | **string** |  | [default to null]
**Rules** | [**[]AlertingRule**](AlertingRule.md) | In order to preserve rule ordering, while exposing type (alerting or recording) specific properties, both alerting and recording rules are exposed in the same array. | [default to null]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


