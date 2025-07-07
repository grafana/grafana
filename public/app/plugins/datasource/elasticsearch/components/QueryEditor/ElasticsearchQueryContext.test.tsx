import { render, renderHook } from '@testing-library/react';
import { PropsWithChildren } from 'react';

import { getDefaultTimeRange } from '@grafana/data';

import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { ElasticDatasource } from '../../datasource';

import { ElasticsearchProvider, useQuery } from './ElasticsearchQueryContext';

const query: ElasticsearchDataQuery = {
  refId: 'A',
  query: '',
  metrics: [{ id: '1', type: 'count' }],
  bucketAggs: [{ type: 'date_histogram', id: '2' }],
};

describe('ElasticsearchQueryContext', () => {
  it('Should call onChange and onRunQuery with the default query when the query is empty', () => {
    const datasource = { timeField: 'TIMEFIELD' } as ElasticDatasource;
    const onChange = jest.fn();
    const onRunQuery = jest.fn();

    render(
      <ElasticsearchProvider
        query={{ refId: 'A' }}
        onChange={onChange}
        datasource={datasource}
        onRunQuery={onRunQuery}
        range={getDefaultTimeRange()}
      />
    );

    const changedQuery: ElasticsearchDataQuery = onChange.mock.calls[0][0];
    expect(changedQuery.query).toBeDefined();
    expect(changedQuery.alias).toBeDefined();
    expect(changedQuery.metrics).toBeDefined();
    expect(changedQuery.bucketAggs).toBeDefined();

    // Should also set timeField to the configured `timeField` option in datasource configuration
    expect(changedQuery.timeField).toBe(datasource.timeField);

    expect(onRunQuery).toHaveBeenCalled();
  });

  // the following applies to all hooks in ElasticsearchQueryContext as they all share the same code.
  describe('useQuery Hook', () => {
    it('Should throw when used outside of ElasticsearchQueryContext', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useQuery());
      }).toThrow();
      expect(console.error).toHaveBeenCalled();
    });

    it('Should return the current query object', () => {
      const wrapper = ({ children }: PropsWithChildren<{}>) => (
        <ElasticsearchProvider
          datasource={{} as ElasticDatasource}
          query={query}
          onChange={() => {}}
          onRunQuery={() => {}}
          range={getDefaultTimeRange()}
        >
          {children}
        </ElasticsearchProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper,
      });

      expect(result.current).toBe(query);
    });
  });
});
