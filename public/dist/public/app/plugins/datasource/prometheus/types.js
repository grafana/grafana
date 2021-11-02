export var PromQueryType;
(function (PromQueryType) {
    PromQueryType["timeSeriesQuery"] = "timeSeriesQuery";
})(PromQueryType || (PromQueryType = {}));
export function isFetchErrorResponse(response) {
    return 'cancelled' in response;
}
export function isMatrixData(result) {
    return 'values' in result;
}
export function isExemplarData(result) {
    if (result == null || !Array.isArray(result)) {
        return false;
    }
    return result.length ? 'exemplars' in result[0] : false;
}
//# sourceMappingURL=types.js.map