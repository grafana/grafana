import { lastValueFrom } from 'rxjs';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DatasourceSrvMock, MockObservableDataSourceApi } from 'test/mocks/datasource_srv';

import { DataQueryRequest, DataSourceInstanceSettings, LoadingState } from '@grafana/data';

import { MIXED_DATASOURCE_NAME } from './MixedDataSource';
import { MixedDatasource } from './module';

const defaultDS = new MockObservableDataSourceApi('DefaultDS', [{ data: ['DDD'] }]);
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  '-- Mixed --': new MockObservableDataSourceApi('mixed'),
  A: new MockObservableDataSourceApi('DSA', [{ data: ['AAAA'] }]),
  B: new MockObservableDataSourceApi('DSB', [{ data: ['BBBB'] }]),
  C: new MockObservableDataSourceApi('DSC', [{ data: ['CCCC'] }]),
  D: new MockObservableDataSourceApi('DSD', [{ data: [] }], undefined, 'syntax error near FROM'),
  E: new MockObservableDataSourceApi('DSE', [{ data: [] }], undefined, 'syntax error near WHERE'),
  Loki: new MockObservableDataSourceApi('Loki', [
    { data: ['A'], key: 'A' },
    { data: ['B'], key: 'B' },
  ]),
});

const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

describe('MixedDatasource', () => {
  describe('with no errors', () => {
    it('direct query should return results', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const requestMixed = getQueryOptions({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } }, // 1
          { refId: 'QB', datasource: { uid: 'B' } }, // 2
          { refId: 'QC', datasource: { uid: 'C' } }, // 3
        ],
      });

      await expect(ds.query(requestMixed)).toEmitValuesWith((results) => {
        expect(results.length).toBe(3);
        expect(results[0].data).toEqual(['AAAA']);
        expect(results[0].state).toEqual(LoadingState.Loading);
        expect(results[1].data).toEqual(['BBBB']);
        expect(results[2].data).toEqual(['CCCC']);
        expect(results[2].state).toEqual(LoadingState.Done);
      });
    });
  });

  describe('with errors', () => {
    it('direct query should return results', async () => {
      const ds = new MixedDatasource({} as DataSourceInstanceSettings);
      const requestMixed = getQueryOptions({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } }, // 1
          { refId: 'QD', datasource: { uid: 'D' } }, // 2
          { refId: 'QB', datasource: { uid: 'B' } }, // 3
          { refId: 'QE', datasource: { uid: 'E' } }, // 4
          { refId: 'QC', datasource: { uid: 'C' } }, // 5
        ],
      });

      await expect(ds.query(requestMixed)).toEmitValuesWith((results) => {
        expect(results[0].data).toEqual(['AAAA']);
        expect(results[0].state).toEqual(LoadingState.Loading);
        expect(results[1].data).toEqual([]);
        expect(results[1].state).toEqual(LoadingState.Error);
        expect(results[1].error).toEqual({ message: 'DSD: syntax error near FROM' });
        expect(results[2].data).toEqual(['BBBB']);
        expect(results[2].state).toEqual(LoadingState.Loading);
        expect(results[3].data).toEqual([]);
        expect(results[3].state).toEqual(LoadingState.Error);
        expect(results[3].error).toEqual({ message: 'DSE: syntax error near WHERE' });
        expect(results[4].data).toEqual(['CCCC']);
        expect(results[4].state).toEqual(LoadingState.Loading);
        expect(results[5].data).toEqual([]);
        expect(results[5].state).toEqual(LoadingState.Error);
        expect(results[5].error).toEqual({ message: 'DSD: syntax error near FROM' });
      });
    });
  });

  it('should return both query results from the same data source', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);
    const request = {
      targets: [
        { refId: 'A', datasource: { uid: 'Loki' } },
        { refId: 'B', datasource: { uid: 'Loki' } },
        { refId: 'C', datasource: { uid: 'A' } },
      ],
    } as DataQueryRequest;

    await expect(ds.query(request)).toEmitValuesWith((results) => {
      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('mixed-0-A');
      expect(results[1].key).toBe('mixed-0-B');
      expect(results[1].state).toBe(LoadingState.Loading);
      expect(results[2].key).toBe('mixed-1-');
      expect(results[2].state).toBe(LoadingState.Done);
    });
  });

  it('should not return the error for the second time', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);
    const request = {
      targets: [
        { refId: 'A', datasource: 'Loki' },
        { refId: 'DD', datasource: 'D' },
        { refId: 'C', datasource: 'A' },
      ],
    } as unknown as DataQueryRequest;

    await lastValueFrom(ds.query(request));

    await expect(
      ds.query({
        targets: [
          { refId: 'QA', datasource: { uid: 'A' } },
          { refId: 'QB', datasource: { uid: 'B' } },
        ],
      } as DataQueryRequest)
    ).toEmitValuesWith((results) => {
      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('mixed-0-');
      expect(results[1].key).toBe('mixed-1-');
      expect(results[1].state).toBe(LoadingState.Done);
    });
  });

  it('should filter out MixedDataSource queries', async () => {
    const ds = new MixedDatasource({} as DataSourceInstanceSettings);

    await expect(
      ds.query({
        targets: [{ refId: 'A', datasource: { uid: MIXED_DATASOURCE_NAME, id: 'datasource' } }],
      } as unknown as DataQueryRequest)
    ).toEmitValuesWith((results) => {
      expect(results).toHaveLength(1);
      expect(results[0].data).toHaveLength(0);
    });
  });
});
