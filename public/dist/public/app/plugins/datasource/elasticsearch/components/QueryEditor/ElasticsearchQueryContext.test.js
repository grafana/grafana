import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { render } from '@testing-library/react';
import { ElasticsearchProvider, useQuery } from './ElasticsearchQueryContext';
import { getDefaultTimeRange } from '@grafana/data';
var query = {
    refId: 'A',
    query: '',
    metrics: [{ id: '1', type: 'count' }],
    bucketAggs: [{ type: 'date_histogram', id: '2' }],
};
describe('ElasticsearchQueryContext', function () {
    it('Should call onChange and onRunQuery with the default query when the query is empty', function () {
        var datasource = { timeField: 'TIMEFIELD' };
        var onChange = jest.fn();
        var onRunQuery = jest.fn();
        render(React.createElement(ElasticsearchProvider, { query: { refId: 'A' }, onChange: onChange, datasource: datasource, onRunQuery: onRunQuery, range: getDefaultTimeRange() }));
        var changedQuery = onChange.mock.calls[0][0];
        expect(changedQuery.query).toBeDefined();
        expect(changedQuery.alias).toBeDefined();
        expect(changedQuery.metrics).toBeDefined();
        expect(changedQuery.bucketAggs).toBeDefined();
        // Should also set timeField to the configured `timeField` option in datasource configuration
        expect(changedQuery.timeField).toBe(datasource.timeField);
        expect(onRunQuery).toHaveBeenCalled();
    });
    // the following applies to all hooks in ElasticsearchQueryContext as they all share the same code.
    describe('useQuery Hook', function () {
        it('Should throw when used outside of ElasticsearchQueryContext', function () {
            var result = renderHook(function () { return useQuery(); }).result;
            expect(result.error).toBeTruthy();
        });
        it('Should return the current query object', function () {
            var wrapper = function (_a) {
                var children = _a.children;
                return (React.createElement(ElasticsearchProvider, { datasource: {}, query: query, onChange: function () { }, onRunQuery: function () { }, range: getDefaultTimeRange() }, children));
            };
            var result = renderHook(function () { return useQuery(); }, {
                wrapper: wrapper,
            }).result;
            expect(result.current).toBe(query);
        });
    });
});
//# sourceMappingURL=ElasticsearchQueryContext.test.js.map