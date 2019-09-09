import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDataSourceSrv } from '@grafana/runtime';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DataSourceInstanceSettings } from '@grafana/ui';
import { MixedDatasource } from './module';

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

  it('direct query should return results', async () => {
    const ds = await getDataSourceSrv().get('-- Mixed --');
    const res = await ds.query(requestMixed);
    expect(res.data).toEqual(['AAAA', 'BBBB', 'CCCC']);
  });
});
