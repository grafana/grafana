import { __awaiter, __generator } from "tslib";
import { lastValueFrom } from 'rxjs';
import { isBucketAggregationType, } from '../components/QueryEditor/BucketAggregationsEditor/aggregations';
import { useDatasource, useRange } from '../components/QueryEditor/ElasticsearchQueryContext';
import { isMetricAggregationType, } from '../components/QueryEditor/MetricAggregationsEditor/aggregations';
var getFilter = function (type) {
    if (isMetricAggregationType(type)) {
        switch (type) {
            case 'cardinality':
                return [];
            case 'top_metrics':
                // top_metrics was introduced in 7.7 where `metrics` only supported number:
                // https://www.elastic.co/guide/en/elasticsearch/reference/7.7/search-aggregations-metrics-top-metrics.html#_metrics
                // TODO: starting from 7.11 it supports ips and keywords as well:
                // https://www.elastic.co/guide/en/elasticsearch/reference/7.11/search-aggregations-metrics-top-metrics.html#_metrics
                return ['number'];
            default:
                return ['number'];
        }
    }
    if (isBucketAggregationType(type)) {
        switch (type) {
            case 'date_histogram':
                return ['date'];
            case 'geohash_grid':
                return ['geo_point'];
            case 'histogram':
                return ['number'];
            default:
                return [];
        }
    }
    return [];
};
var toSelectableValue = function (_a) {
    var text = _a.text;
    return ({
        label: text,
        value: text,
    });
};
/**
 * Returns a function to query the configured datasource for autocomplete values for the specified aggregation type or data types.
 * Each aggregation can be run on different types, for example avg only operates on numeric fields, geohash_grid only on geo_point fields.
 * If an aggregation type is provided, the promise will resolve with all fields suitable to be used as a field for the given aggregation.
 * If an array of types is providem the promise will resolve with all the fields matching the provided types.
 * @param aggregationType the type of aggregation to get fields for
 */
export var useFields = function (type) {
    var datasource = useDatasource();
    var range = useRange();
    var filter = Array.isArray(type) ? type : getFilter(type);
    var rawFields;
    return function (q) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!!rawFields) return [3 /*break*/, 2];
                    return [4 /*yield*/, lastValueFrom(datasource.getFields(filter, range))];
                case 1:
                    rawFields = _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, rawFields.filter(function (_a) {
                        var text = _a.text;
                        return q === undefined || text.includes(q);
                    }).map(toSelectableValue)];
            }
        });
    }); };
};
//# sourceMappingURL=useFields.js.map