import { LokiQueryType, SupportingQueryType, LokiQueryDirection } from './dataquery.gen';
export { LokiQueryDirection, LokiQueryType, SupportingQueryType };
export var LokiResultType;
(function (LokiResultType) {
    LokiResultType["Stream"] = "streams";
    LokiResultType["Vector"] = "vector";
    LokiResultType["Matrix"] = "matrix";
})(LokiResultType || (LokiResultType = {}));
export var LokiVariableQueryType;
(function (LokiVariableQueryType) {
    LokiVariableQueryType[LokiVariableQueryType["LabelNames"] = 0] = "LabelNames";
    LokiVariableQueryType[LokiVariableQueryType["LabelValues"] = 1] = "LabelValues";
})(LokiVariableQueryType || (LokiVariableQueryType = {}));
//# sourceMappingURL=types.js.map