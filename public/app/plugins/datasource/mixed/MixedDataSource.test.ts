import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDataSourceSrv } from '@grafana/runtime';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { LoadingState, DataSourceInstanceSettings } from '@grafana/data';
import { MixedDatasource } from './module';
import { from } from 'rxjs';

const defaultDS = new MockDataSourceApi('DefaultDS', { data: ['DDD'] });
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  '-- Mixed --': new MixedDatasource({ name: 'mixed', id: 5 } as DataSourceInstanceSettings),
  A: new MockDataSourceApi('DSA', { data: ['AAAA'] }),
  B: new MockDataSourceApi('DSB', { data: ['BBBB'] }),
  C: new MockDataSourceApi('DSC', { data: ['CCCC'] }),
});

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: () => {
    return datasourceSrv;
  },
}));

describe('MixedDatasource', () => {
  const requestMixed = getQueryOptions({
    targets: [
      { refId: 'QA', datasource: 'A' }, // 1
      { refId: 'QB', datasource: 'B' }, // 2
      { refId: 'QC', datasource: 'C' }, // 3
    ],
  });
  const results: any[] = [];

  beforeEach(async done => {
    const ds = await getDataSourceSrv().get('-- Mixed --');

    from(ds.query(requestMixed)).subscribe(result => {
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
