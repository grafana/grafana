import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { useNextId } from './useNextId';
import { getDefaultTimeRange } from '@grafana/data';
describe('useNextId', function () {
    it('Should return the next available id', function () {
        var query = {
            refId: 'A',
            query: '',
            metrics: [{ id: '1', type: 'avg' }],
            bucketAggs: [{ id: '2', type: 'date_histogram' }],
        };
        var wrapper = function (_a) {
            var children = _a.children;
            return (React.createElement(ElasticsearchProvider, { query: query, datasource: {}, onChange: function () { }, onRunQuery: function () { }, range: getDefaultTimeRange() }, children));
        };
        var result = renderHook(function () { return useNextId(); }, {
            wrapper: wrapper,
        }).result;
        expect(result.current).toBe('3');
    });
});
//# sourceMappingURL=useNextId.test.js.map