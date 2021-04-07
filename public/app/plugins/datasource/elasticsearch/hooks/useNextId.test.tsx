import React, { FunctionComponent } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { useNextId } from './useNextId';
import { ElasticsearchQuery } from '../types';

describe('useNextId', () => {
  it('Should return the next available id', () => {
    const query: ElasticsearchQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'avg' }],
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };
    const wrapper: FunctionComponent = ({ children }) => {
      return (
        <ElasticsearchProvider query={query} datasource={{} as any} onChange={() => {}} onRunQuery={() => {}}>
          {children}
        </ElasticsearchProvider>
      );
    };

    const { result } = renderHook(() => useNextId(), {
      wrapper,
    });

    expect(result.current).toBe('3');
  });
});
