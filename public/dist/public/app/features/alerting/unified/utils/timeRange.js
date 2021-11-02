import { __read, __spreadArray, __values } from "tslib";
import { ExpressionQueryType } from '../../../expressions/types';
var FALL_BACK_TIME_RANGE = { from: 21600, to: 0 };
export var getTimeRangeForExpression = function (query, queries) {
    var referencedRefIds = getReferencedIds(query, queries);
    if (!referencedRefIds) {
        return FALL_BACK_TIME_RANGE;
    }
    var _a = getTimeRanges(referencedRefIds, queries), from = _a.from, to = _a.to;
    if (!from.length && !to.length) {
        return FALL_BACK_TIME_RANGE;
    }
    return {
        from: Math.max.apply(Math, __spreadArray([], __read(from), false)),
        to: Math.min.apply(Math, __spreadArray([], __read(to), false)),
    };
};
var getReferencedIds = function (model, queries) {
    switch (model.type) {
        case ExpressionQueryType.classic:
            return getReferencedIdsForClassicCondition(model);
        case ExpressionQueryType.math:
            return getReferencedIdsForMath(model, queries);
        case ExpressionQueryType.resample:
        case ExpressionQueryType.reduce:
            return getReferencedIdsForReduce(model);
    }
};
var getReferencedIdsForClassicCondition = function (model) {
    var _a;
    return (_a = model.conditions) === null || _a === void 0 ? void 0 : _a.map(function (condition) {
        return condition.query.params[0];
    });
};
var getTimeRanges = function (referencedRefIds, queries) {
    var e_1, _a;
    var from = [];
    var to = [FALL_BACK_TIME_RANGE.to];
    var _loop_1 = function (referencedRefIdsKey) {
        var query = queries.find(function (query) { return query.refId === referencedRefIdsKey; });
        if (!query || !query.relativeTimeRange) {
            return "continue";
        }
        from.push(query.relativeTimeRange.from);
        to.push(query.relativeTimeRange.to);
    };
    try {
        for (var referencedRefIds_1 = __values(referencedRefIds), referencedRefIds_1_1 = referencedRefIds_1.next(); !referencedRefIds_1_1.done; referencedRefIds_1_1 = referencedRefIds_1.next()) {
            var referencedRefIdsKey = referencedRefIds_1_1.value;
            _loop_1(referencedRefIdsKey);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (referencedRefIds_1_1 && !referencedRefIds_1_1.done && (_a = referencedRefIds_1.return)) _a.call(referencedRefIds_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return {
        from: from,
        to: to,
    };
};
var getReferencedIdsForMath = function (model, queries) {
    return (queries
        // filter queries of type query and filter expression on if it includes any refIds
        .filter(function (q) { var _a; return q.queryType === 'query' && ((_a = model.expression) === null || _a === void 0 ? void 0 : _a.includes(q.refId)); })
        .map(function (q) {
        return q.refId;
    }));
};
var getReferencedIdsForReduce = function (model) {
    return model.expression ? [model.expression] : undefined;
};
//# sourceMappingURL=timeRange.js.map