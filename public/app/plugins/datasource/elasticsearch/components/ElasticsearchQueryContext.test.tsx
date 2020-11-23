import React, { FunctionComponent } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { ElasticsearchProvider, useDatasource, useQuery } from './ElasticsearchQueryContext';
import { ElasticsearchQuery } from '../types';
import { ElasticDatasource } from '../datasource';

describe('ElasticsearchQueryContext', () => {
  describe('useQuery Hook', () => {
    it('Should throw when used outside of ElasticsearchQueryContext', () => {
      const { result } = renderHook(() => useQuery());

      expect(result.error).toBeTruthy();
    });

    it('Should return the current query object', () => {
      const query: ElasticsearchQuery = { refId: 'A' };

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
        <ElasticsearchProvider datasource={datasource} query={{} as ElasticsearchQuery} onChange={() => {}}>
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
