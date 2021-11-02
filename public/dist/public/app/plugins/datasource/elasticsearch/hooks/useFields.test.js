import { __awaiter, __generator } from "tslib";
import React from 'react';
import { from } from 'rxjs';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { getDefaultTimeRange } from '@grafana/data';
import { defaultBucketAgg, defaultMetricAgg } from '../query_def';
import { renderHook } from '@testing-library/react-hooks';
import { useFields } from './useFields';
describe('useFields hook', function () {
    // TODO: If we move the field type to the configuration objects as described in the hook's source
    // we can stop testing for getField to be called with the correct parameters.
    it("returns a function that calls datasource's getFields with the correct parameters", function () { return __awaiter(void 0, void 0, void 0, function () {
        var timeRange, query, getFields, wrapper, _a, result, rerender;
        return __generator(this, function (_b) {
            timeRange = getDefaultTimeRange();
            query = {
                refId: 'A',
                query: '',
                metrics: [defaultMetricAgg()],
                bucketAggs: [defaultBucketAgg()],
            };
            getFields = jest.fn(function () { return from([[]]); });
            wrapper = function (_a) {
                var children = _a.children;
                return (React.createElement(ElasticsearchProvider, { datasource: { getFields: getFields }, query: query, range: timeRange, onChange: function () { }, onRunQuery: function () { } }, children));
            };
            _a = renderHook(function (aggregationType) { return useFields(aggregationType); }, { wrapper: wrapper, initialProps: 'cardinality' }), result = _a.result, rerender = _a.rerender;
            result.current();
            expect(getFields).toHaveBeenLastCalledWith([], timeRange);
            // All other metric aggregations only work on numbers
            rerender('avg');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith(['number'], timeRange);
            //
            // BUCKET AGGREGATIONS
            //
            // Date Histrogram only works on dates
            rerender('date_histogram');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith(['date'], timeRange);
            // Histrogram only works on numbers
            rerender('histogram');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith(['number'], timeRange);
            // Geohash Grid only works on geo_point data
            rerender('geohash_grid');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith(['geo_point'], timeRange);
            // All other bucket aggregation work on any kind of data
            rerender('terms');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith([], timeRange);
            // top_metrics work on only on numeric data in 7.7
            rerender('top_metrics');
            result.current();
            expect(getFields).toHaveBeenLastCalledWith(['number'], timeRange);
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=useFields.test.js.map