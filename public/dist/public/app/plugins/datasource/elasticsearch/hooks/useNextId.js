import { __read, __spreadArray } from "tslib";
import { useMemo } from 'react';
import { useQuery } from '../components/QueryEditor/ElasticsearchQueryContext';
var toId = function (e) { return e.id; };
var toInt = function (idString) { return parseInt(idString, 10); };
export var useNextId = function () {
    var _a = useQuery(), metrics = _a.metrics, bucketAggs = _a.bucketAggs;
    return useMemo(function () {
        return (Math.max.apply(Math, __spreadArray([], __read(__spreadArray(__spreadArray([], __read(((metrics === null || metrics === void 0 ? void 0 : metrics.map(toId)) || ['0'])), false), __read(((bucketAggs === null || bucketAggs === void 0 ? void 0 : bucketAggs.map(toId)) || ['0'])), false).map(toInt)), false)) + 1).toString();
    }, [metrics, bucketAggs]);
};
//# sourceMappingURL=useNextId.js.map