import { Observable, of } from 'rxjs';

import {
  DataFrame,
  createDataFrame,
  dataFrameToJSON,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  ScopedVars,
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  TestDataSourceResponse,
} from '@grafana/data';
import { GetDataSourceListFilters, setDataSourceSrv, toDataQueryResponse } from '@grafana/runtime';

import { CloudWatchLogsQueryStatus } from '../types';

import { meta, setupMockedDataSource } from './CloudWatchDataSource';

export function setupForLogs() {
  function envelope(frame: DataFrame) {
    return toDataQueryResponse({ data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } });
  }

  const { datasource, queryMock } = setupMockedDataSource();

  const startQueryFrame: DataFrame = createDataFrame({ fields: [{ name: 'queryId', values: ['queryid'] }] });
  queryMock.mockReturnValueOnce(of(envelope(startQueryFrame)));

  const logsFrame: DataFrame = createDataFrame({
    fields: [
      {
        name: '@message',
        values: ['something'],
      },
      {
        name: '@timestamp',
        values: [1],
      },
      {
        name: '@xrayTraceId',
        values: ['1-613f0d6b-3e7cb34375b60662359611bd'],
      },
    ],
    meta: { custom: { Status: CloudWatchLogsQueryStatus.Complete } },
  });

  queryMock.mockReturnValueOnce(of(envelope(logsFrame)));

  setDataSourceSrv({
    registerRuntimeDataSource: jest.fn(),
    async get() {
      const ds: DataSourceApi = {
        name: 'Xray',
        id: 0,
        type: '',
        uid: '',
        query: function (
          request: DataQueryRequest<DataQuery>
        ): Observable<DataQueryResponse> | Promise<DataQueryResponse> {
          throw new Error('Function not implemented.');
        },
        testDatasource: function (): Promise<TestDataSourceResponse> {
          throw new Error('Function not implemented.');
        },
        meta: meta,
        getRef: function (): DataSourceRef {
          throw new Error('Function not implemented.');
        },
      };

      return ds;
    },
    getList: function (
      filters?: GetDataSourceListFilters | undefined
    ): Array<DataSourceInstanceSettings<DataSourceJsonData>> {
      throw new Error('Function not implemented.');
    },
    getInstanceSettings: function (
      ref?: string | DataSourceRef | null | undefined,
      scopedVars?: ScopedVars | undefined
    ): DataSourceInstanceSettings<DataSourceJsonData> | undefined {
      throw new Error('Function not implemented.');
    },
    reload: function (): void {
      throw new Error('Function not implemented.');
    },
  });

  return { datasource, queryMock };
}
