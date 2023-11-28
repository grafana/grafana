import { defaultGeoHashPrecisionString } from 'app/plugins/datasource/elasticsearch/queryDef';
import { describeMetric, convertOrderByToMetricId } from '../../../../utils';
import { useQuery } from '../../ElasticsearchQueryContext';
import { bucketAggregationConfig, orderByOptions, orderOptions } from '../utils';
const hasValue = (value) => (object) => object.value === value;
// FIXME: We should apply the same defaults we have in bucketAggregationsConfig here instead of "custom" values
// as they might get out of sync.
// The reason we need them is that even though after the refactoring each setting is created with its default value,
// queries created with the old version might not have them.
export const useDescription = (bucketAgg) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    const { metrics } = useQuery();
    switch (bucketAgg.type) {
        case 'terms': {
            const order = ((_a = bucketAgg.settings) === null || _a === void 0 ? void 0 : _a.order) || 'desc';
            const size = ((_b = bucketAgg.settings) === null || _b === void 0 ? void 0 : _b.size) || '10';
            const minDocCount = parseInt(((_c = bucketAgg.settings) === null || _c === void 0 ? void 0 : _c.min_doc_count) || '0', 10);
            const orderBy = ((_d = bucketAgg.settings) === null || _d === void 0 ? void 0 : _d.orderBy) || '_term';
            let description = '';
            if (size !== '0') {
                const orderLabel = (_e = orderOptions.find(hasValue(order))) === null || _e === void 0 ? void 0 : _e.label;
                description = `${orderLabel} ${size}, `;
            }
            if (minDocCount > 0) {
                description += `Min Doc Count: ${minDocCount}, `;
            }
            description += 'Order by: ';
            const orderByOption = orderByOptions.find(hasValue(orderBy));
            if (orderByOption) {
                description += orderByOption.label;
            }
            else {
                const metric = metrics === null || metrics === void 0 ? void 0 : metrics.find((m) => m.id === convertOrderByToMetricId(orderBy));
                if (metric) {
                    description += describeMetric(metric);
                }
                else {
                    description += 'metric not found';
                }
            }
            if (size === '0') {
                description += ` (${order})`;
            }
            return description;
        }
        case 'histogram': {
            const interval = ((_f = bucketAgg.settings) === null || _f === void 0 ? void 0 : _f.interval) || '1000';
            const minDocCount = parseInt(((_g = bucketAgg.settings) === null || _g === void 0 ? void 0 : _g.min_doc_count) || '1', 10);
            return `Interval: ${interval}${minDocCount > 0 ? `, Min Doc Count: ${minDocCount}` : ''}`;
        }
        case 'filters': {
            const filters = ((_h = bucketAgg.settings) === null || _h === void 0 ? void 0 : _h.filters) || ((_j = bucketAggregationConfig['filters'].defaultSettings) === null || _j === void 0 ? void 0 : _j.filters);
            return `Filter Queries (${filters.length})`;
        }
        case 'geohash_grid': {
            const precision = parseInt(((_k = bucketAgg.settings) === null || _k === void 0 ? void 0 : _k.precision) || defaultGeoHashPrecisionString, 10);
            return `Precision: ${precision}`;
        }
        case 'date_histogram': {
            const interval = ((_l = bucketAgg.settings) === null || _l === void 0 ? void 0 : _l.interval) || 'auto';
            const minDocCount = parseInt(((_m = bucketAgg.settings) === null || _m === void 0 ? void 0 : _m.min_doc_count) || '0', 10);
            const trimEdges = parseInt(((_o = bucketAgg.settings) === null || _o === void 0 ? void 0 : _o.trimEdges) || '0', 10);
            let description = `Interval: ${interval}`;
            if (minDocCount > 0) {
                description += `, Min Doc Count: ${minDocCount}`;
            }
            if (trimEdges > 0) {
                description += `, Trim edges: ${trimEdges}`;
            }
            return description;
        }
        default:
            return 'Settings';
    }
};
//# sourceMappingURL=useDescription.js.map