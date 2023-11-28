import { __awaiter } from "tslib";
import { renderHook } from '@testing-library/react';
import React from 'react';
import { from } from 'rxjs';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { defaultBucketAgg, defaultMetricAgg } from '../queryDef';
import { useFields } from './useFields';
describe('useFields hook', () => {
    // TODO: If we move the field type to the configuration objects as described in the hook's source
    // we can stop testing for getField to be called with the correct parameters.
    it("returns a function that calls datasource's getFields with the correct parameters", () => __awaiter(void 0, void 0, void 0, function* () {
        const timeRange = getDefaultTimeRange();
        const query = {
            refId: 'A',
            query: '',
            metrics: [defaultMetricAgg()],
            bucketAggs: [defaultBucketAgg()],
        };
        const getFields = jest.fn(() => from([[]]));
        const wrapper = ({ children }) => (React.createElement(ElasticsearchProvider, { datasource: { getFields }, query: query, range: timeRange, onChange: () => { }, onRunQuery: () => { } }, children));
        //
        // METRIC AGGREGATIONS
        //
        // Cardinality works on every kind of data
        const { result, rerender } = renderHook((aggregationType) => useFields(aggregationType), { wrapper, initialProps: 'cardinality' });
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
    }));
});
//# sourceMappingURL=useFields.test.js.map