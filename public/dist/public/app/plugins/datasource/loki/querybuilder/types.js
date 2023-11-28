export var LokiQueryPatternType;
(function (LokiQueryPatternType) {
    LokiQueryPatternType["Log"] = "log";
    LokiQueryPatternType["Metric"] = "metric";
})(LokiQueryPatternType || (LokiQueryPatternType = {}));
export var LokiVisualQueryOperationCategory;
(function (LokiVisualQueryOperationCategory) {
    LokiVisualQueryOperationCategory["Aggregations"] = "Aggregations";
    LokiVisualQueryOperationCategory["RangeFunctions"] = "Range functions";
    LokiVisualQueryOperationCategory["Functions"] = "Functions";
    LokiVisualQueryOperationCategory["Formats"] = "Formats";
    LokiVisualQueryOperationCategory["LineFilters"] = "Line filters";
    LokiVisualQueryOperationCategory["LabelFilters"] = "Label filters";
    LokiVisualQueryOperationCategory["BinaryOps"] = "Binary operations";
})(LokiVisualQueryOperationCategory || (LokiVisualQueryOperationCategory = {}));
export var LokiOperationId;
(function (LokiOperationId) {
    LokiOperationId["Json"] = "json";
    LokiOperationId["Logfmt"] = "logfmt";
    LokiOperationId["Regexp"] = "regexp";
    LokiOperationId["Pattern"] = "pattern";
    LokiOperationId["Unpack"] = "unpack";
    LokiOperationId["LineFormat"] = "line_format";
    LokiOperationId["LabelFormat"] = "label_format";
    LokiOperationId["Decolorize"] = "decolorize";
    LokiOperationId["Drop"] = "drop";
    LokiOperationId["Keep"] = "keep";
    LokiOperationId["Rate"] = "rate";
    LokiOperationId["RateCounter"] = "rate_counter";
    LokiOperationId["CountOverTime"] = "count_over_time";
    LokiOperationId["SumOverTime"] = "sum_over_time";
    LokiOperationId["AvgOverTime"] = "avg_over_time";
    LokiOperationId["MaxOverTime"] = "max_over_time";
    LokiOperationId["MinOverTime"] = "min_over_time";
    LokiOperationId["FirstOverTime"] = "first_over_time";
    LokiOperationId["LastOverTime"] = "last_over_time";
    LokiOperationId["StdvarOverTime"] = "stdvar_over_time";
    LokiOperationId["StddevOverTime"] = "stddev_over_time";
    LokiOperationId["QuantileOverTime"] = "quantile_over_time";
    LokiOperationId["BytesRate"] = "bytes_rate";
    LokiOperationId["BytesOverTime"] = "bytes_over_time";
    LokiOperationId["AbsentOverTime"] = "absent_over_time";
    LokiOperationId["Sum"] = "sum";
    LokiOperationId["Avg"] = "avg";
    LokiOperationId["Min"] = "min";
    LokiOperationId["Max"] = "max";
    LokiOperationId["Stddev"] = "stddev";
    LokiOperationId["Stdvar"] = "stdvar";
    LokiOperationId["Count"] = "count";
    LokiOperationId["TopK"] = "topk";
    LokiOperationId["BottomK"] = "bottomk";
    LokiOperationId["LineContains"] = "__line_contains";
    LokiOperationId["LineContainsNot"] = "__line_contains_not";
    LokiOperationId["LineContainsCaseInsensitive"] = "__line_contains_case_insensitive";
    LokiOperationId["LineContainsNotCaseInsensitive"] = "__line_contains_not_case_insensitive";
    LokiOperationId["LineMatchesRegex"] = "__line_matches_regex";
    LokiOperationId["LineMatchesRegexNot"] = "__line_matches_regex_not";
    LokiOperationId["LineFilterIpMatches"] = "__line_filter_ip_matches";
    LokiOperationId["LabelFilter"] = "__label_filter";
    LokiOperationId["LabelFilterNoErrors"] = "__label_filter_no_errors";
    LokiOperationId["LabelFilterIpMatches"] = "__label_filter_ip_marches";
    LokiOperationId["Unwrap"] = "unwrap";
    LokiOperationId["SumBy"] = "__sum_by";
    LokiOperationId["SumWithout"] = "__sum_without";
    // Binary ops
    LokiOperationId["Addition"] = "__addition";
    LokiOperationId["Subtraction"] = "__subtraction";
    LokiOperationId["MultiplyBy"] = "__multiply_by";
    LokiOperationId["DivideBy"] = "__divide_by";
    LokiOperationId["Modulo"] = "__modulo";
    LokiOperationId["Exponent"] = "__exponent";
    LokiOperationId["NestedQuery"] = "__nested_query";
    LokiOperationId["EqualTo"] = "__equal_to";
    LokiOperationId["NotEqualTo"] = "__not_equal_to";
    LokiOperationId["GreaterThan"] = "__greater_than";
    LokiOperationId["LessThan"] = "__less_than";
    LokiOperationId["GreaterOrEqual"] = "__greater_or_equal";
    LokiOperationId["LessOrEqual"] = "__less_or_equal";
})(LokiOperationId || (LokiOperationId = {}));
export var LokiOperationOrder;
(function (LokiOperationOrder) {
    LokiOperationOrder[LokiOperationOrder["LineFilters"] = 1] = "LineFilters";
    LokiOperationOrder[LokiOperationOrder["Parsers"] = 2] = "Parsers";
    LokiOperationOrder[LokiOperationOrder["PipeOperations"] = 3] = "PipeOperations";
    // Unwrap is a special case, as it is usually the last operation, so the order is after pipeOperations
    LokiOperationOrder[LokiOperationOrder["Unwrap"] = 4] = "Unwrap";
    LokiOperationOrder[LokiOperationOrder["NoErrors"] = 5] = "NoErrors";
    LokiOperationOrder[LokiOperationOrder["RangeVectorFunction"] = 5] = "RangeVectorFunction";
    LokiOperationOrder[LokiOperationOrder["Last"] = 6] = "Last";
})(LokiOperationOrder || (LokiOperationOrder = {}));
export const lokiOperators = {
    equals: { label: '=', value: '=', description: 'Equals', isMultiValue: false },
    doesNotEqual: { label: '!=', value: '!=', description: 'Does not equal', isMultiValue: false },
    matchesRegex: { label: '=~', value: '=~', description: 'Matches regex', isMultiValue: true },
    doesNotMatchRegex: { label: '!~', value: '!~', description: 'Does not match regex', isMultiValue: true },
    greaterThan: { label: '>', value: '>', description: 'Greater than', isMultiValue: false },
    greaterThanOrEqual: { label: '>=', value: '>=', description: 'Greater than or equal to', isMultiValue: false },
    lessThan: { label: '<', value: '<', description: 'Less than', isMultiValue: false },
    lessThanOrEqual: { label: '<=', value: '<=', description: 'Less than or equal to', isMultiValue: false },
    contains: { label: '|=', value: '|=', description: 'Contains', isMultiValue: false },
    doesNotContain: { label: '!=', value: '!=', description: 'Does not contain', isMultiValue: false },
};
//# sourceMappingURL=types.js.map