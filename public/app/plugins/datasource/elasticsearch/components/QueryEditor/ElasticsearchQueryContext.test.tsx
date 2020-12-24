import React, { FunctionComponent } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { render } from '@testing-library/react';
import { ElasticsearchProvider, useDatasource, useQuery } from './ElasticsearchQueryContext';
import { ElasticsearchQuery } from '../../types';
import { ElasticDatasource } from '../../datasource';

const query: ElasticsearchQuery = {
  refId: 'A',
  metrics: [{ id: '1', type: 'count' }],
  bucketAggs: [{ type: 'date_histogram', id: '2' }],
};

describe('ElasticsearchQueryContext', () => {
  it('Should call onChange with the default query when the query is empty', () => {
    const datasource = { timeField: 'TIMEFIELD' } as ElasticDatasource;
    const onChange = jest.fn();

    render(<ElasticsearchProvider query={{ refId: 'A' }} onChange={onChange} datasource={datasource} />);

    const changedQuery: ElasticsearchQuery = onChange.mock.calls[0][0];
    expect(changedQuery.query).toBeDefined();
    expect(changedQuery.alias).toBeDefined();
    expect(changedQuery.metrics).toBeDefined();
    expect(changedQuery.bucketAggs).toBeDefined();

    // Should also set timeField to the configured `timeField` option in datasource configuration
    expect(changedQuery.timeField).toBe(datasource.timeField);
  });

  describe('useQuery Hook', () => {
    it('Should throw when used outside of ElasticsearchQueryContext', () => {
      const { result } = renderHook(() => useQuery());

      expect(result.error).toBeTruthy();
    });

    it('Should return the current query object', () => {
      const wrapper: FunctionComponent = ({ children }) => (
        <ElasticsearchProvider datasource={{} as ElasticDatasource} query={query} onChange={() => {}}>
          {children}
        </ElasticsearchProvider>
      );

      const { result } = renderHook(() => useQuery(), {
        wrapper,
      });

      expect(result.current).toBe(query);
    });
  });

  describe('useDatasource Hook', () => {
    it('Should throw when used outside of ElasticsearchQueryContext', () => {
      const { result } = renderHook(() => useDatasource());

      expect(result.error).toBeTruthy();
    });

    it('Should return the current datasource instance', () => {
      const datasource = {} as ElasticDatasource;

      const wrapper: FunctionComponent = ({ children }) => (
        <ElasticsearchProvider datasource={datasource} query={query} onChange={() => {}}>
          {children}
        </ElasticsearchProvider>
      );

      const { result } = renderHook(() => useDatasource(), {
        wrapper,
      });

      expect(result.current).toBe(datasource);
    });
  });
});
