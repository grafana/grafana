# InhibitRule

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Equal** | [***LabelNames**](LabelNames.md) |  | [optional] [default to null]
**SourceMatch** | **map[string]string** | SourceMatch defines a set of labels that have to equal the given value for source alerts. Deprecated. Remove before v1.0 release. | [optional] [default to null]
**SourceMatchRe** | [***MatchRegexps**](MatchRegexps.md) |  | [optional] [default to null]
**SourceMatchers** | [***Matchers**](Matchers.md) |  | [optional] [default to null]
**TargetMatch** | **map[string]string** | TargetMatch defines a set of labels that have to equal the given value for target alerts. Deprecated. Remove before v1.0 release. | [optional] [default to null]
**TargetMatchRe** | [***MatchRegexps**](MatchRegexps.md) |  | [optional] [default to null]
**TargetMatchers** | [***Matchers**](Matchers.md) |  | [optional] [default to null]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


