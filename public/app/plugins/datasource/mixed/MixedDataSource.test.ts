import { from, merge } from 'rxjs';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataSourceInstanceSettings, LoadingState } from '@grafana/data';

import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { MixedDatasource } from './module';

const defaultDS = new MockDataSourceApi('DefaultDS', { data: ['DDD'] });
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  '-- Mixed --': new MixedDatasource({ name: 'mixed', id: 5 } as DataSourceInstanceSettings),
  A: new MockDataSourceApi('DSA', { data: ['AAAA'] }),
  B: new MockDataSourceApi('DSB', { data: ['BBBB'] }),
  C: new MockDataSourceApi('DSC', { data: ['CCCC'] }),
  D: new MockDataSourceApi('DSD', { data: [] }, {}, 'syntax error near FROM'),
  E: new MockDataSourceApi('DSE', { data: [] }, {}, 'syntax error near WHERE'),
});

const getDataSourceSrvMock = jest.fn().mockReturnValue(datasourceSrv);
jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getDataSourceSrv: () => getDataSourceSrvMock(),
}));

describe('MixedDatasource', () => {
  describe('with no errors', () => {
    const requestMixed = getQueryOptions({
      targets: [
        { refId: 'QA', datasource: 'A' }, // 1
        { refId: 'QB', datasource: 'B' }, // 2
        { refId: 'QC', datasource: 'C' }, // 3
      ],
    });
    const results: any[] = [];

    beforeEach(async (done) => {
      const ds = await getDataSourceSrv().get('-- Mixed --');

      from(ds.query(requestMixed)).subscribe((result) => {
        results.push(result);
        if (result.state === LoadingState.Done) {
          done();
        }
      });
    });

    it('direct query should return results', async () => {
      expect(results.length).toBe(3);
      expect(results[0].data).toEqual(['AAAA']);
      expect(results[0].state).toEqual(LoadingState.Loading);
      expect(results[1].data).toEqual(['BBBB']);
      expect(results[2].data).toEqual(['CCCC']);
      expect(results[2].state).toEqual(LoadingState.Done);
      expect(results.length).toBe(3);
    });
  });

  describe('with errors', () => {
    const requestMixed = getQueryOptions({
      targets: [
        { refId: 'QA', datasource: 'A' }, // 1
        { refId: 'QD', datasource: 'D' }, // 2
        { refId: 'QB', datasource: 'B' }, // 3
        { refId: 'QE', datasource: 'E' }, // 4
        { refId: 'QC', datasource: 'C' }, // 5
      ],
    });
    const results: any[] = [];

    beforeEach(async (done) => {
      const ds = await getDataSourceSrv().get('-- Mixed --');

      from(ds.query(requestMixed)).subscribe((result) => {
        results.push(result);
        if (results.length === 5) {
          done();
        }
      });
    });

    it('direct query should return results', async () => {
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

  it('should return both query results from the same data source', async () => {
    getDataSourceSrvMock.mockImplementationOnce(() => {
      return { get: () => Promise.resolve(mockDs()) };
    });
    const ds = new MixedDatasource({} as any);
    const request: any = {
      targets: [
        { refId: 'A', datasource: 'Loki' },
        { refId: 'B', datasource: 'Loki' },
      ],
    };

    await expect(ds.query(request)).toEmitValuesWith((resp) => {
      expect(resp).toHaveLength(2);
      expect(resp[0].key).toBe('mixed-0-A');
      expect(resp[1].key).toBe('mixed-0-B');
    });
  });
});

const mockDs = jest.fn(() => ({
  query: (q: any) => {
    const promises = [];
    for (const target of q.targets) {
      promises.push(from(Promise.resolve({ key: target.refId })));
    }
    return merge(...promises);
  },
}));
