import { renderHook } from '@testing-library/react';
import React from 'react';
import { getDefaultTimeRange } from '@grafana/data';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { useNextId } from './useNextId';
describe('useNextId', () => {
    it('Should return the next available id', () => {
        const query = {
            refId: 'A',
            query: '',
            metrics: [{ id: '1', type: 'avg' }],
            bucketAggs: [{ id: '2', type: 'date_histogram' }],
        };
        const wrapper = ({ children }) => {
            return (React.createElement(ElasticsearchProvider, { query: query, datasource: {}, onChange: () => { }, onRunQuery: () => { }, range: getDefaultTimeRange() }, children));
        };
        const { result } = renderHook(() => useNextId(), {
            wrapper,
        });
        expect(result.current).toBe('3');
    });
});
//# sourceMappingURL=useNextId.test.js.map