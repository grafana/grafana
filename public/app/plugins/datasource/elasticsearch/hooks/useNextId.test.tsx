import React, { PropsWithChildren } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { useNextId } from './useNextId';
import { ElasticsearchQuery } from '../types';
import { getDefaultTimeRange } from '@grafana/data';

describe('useNextId', () => {
  it('Should return the next available id', () => {
    const query: ElasticsearchQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'avg' }],
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };
    const wrapper = ({ children }: PropsWithChildren<{}>) => {
      return (
        <ElasticsearchProvider
          query={query}
          datasource={{} as any}
          onChange={() => {}}
          onRunQuery={() => {}}
          range={getDefaultTimeRange()}
        >
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
