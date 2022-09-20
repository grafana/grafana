import { Observable, of } from 'rxjs';

import {
  DataFrame,
  dataFrameToJSON,
  MutableDataFrame,
  ArrayVector,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  ScopedVars,
  DataSourceApi,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
} from '@grafana/data';
import { GetDataSourceListFilters, setDataSourceSrv } from '@grafana/runtime';

import { CloudWatchDatasource } from '../datasource';
import { CloudWatchLogsQueryStatus } from '../types';

import { meta, setupMockedDataSource } from './CloudWatchDataSource';

export function setupForLogs() {
  function envelope(frame: DataFrame) {
    return { data: { results: { a: { refId: 'a', frames: [dataFrameToJSON(frame)] } } } };
  }

  const { datasource, fetchMock, timeSrv } = setupMockedDataSource();

  const startQueryFrame = new MutableDataFrame({ fields: [{ name: 'queryId', values: ['queryid'] }] });
  fetchMock.mockReturnValueOnce(of(envelope(startQueryFrame)));

  const logsFrame = new MutableDataFrame({
    fields: [
      {
        name: '@message',
        values: new ArrayVector(['something']),
      },
      {
        name: '@timestamp',
        values: new ArrayVector([1]),
      },
      {
        name: '@xrayTraceId',
        values: new ArrayVector(['1-613f0d6b-3e7cb34375b60662359611bd']),
      },
    ],
    meta: { custom: { Status: CloudWatchLogsQueryStatus.Complete } },
  });

  fetchMock.mockReturnValueOnce(of(envelope(logsFrame)));

  setDataSourceSrv({
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
        testDatasource: function (): Promise<CloudWatchDatasource> {
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

  return { datasource, fetchMock, timeSrv };
}
