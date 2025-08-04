import { renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';

import { getDefaultTimeRange } from '@grafana/data';

import { ElasticsearchProvider } from '../components/QueryEditor/ElasticsearchQueryContext';
import { ElasticsearchDataQuery } from '../dataquery.gen';
import { ElasticDatasource } from '../datasource';

import { useNextId } from './useNextId';

describe('useNextId', () => {
  it('Should return the next available id', () => {
    const query: ElasticsearchDataQuery = {
      refId: 'A',
      query: '',
      metrics: [{ id: '1', type: 'avg' }],
      bucketAggs: [{ id: '2', type: 'date_histogram' }],
    };
    const wrapper = ({ children }: PropsWithChildren<{}>) => {
      return (
        <ElasticsearchProvider
          query={query}
          datasource={{} as ElasticDatasource}
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
