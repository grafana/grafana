import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DataSourceStream, PanelData } from '@grafana/ui';
import { Unsubscribable } from 'rxjs';

const defaultDS = new MockDataSourceApi({ data: ['A', 'B'] });
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  A: new MockDataSourceApi({ data: ['AAAA'] }),
  B: new MockDataSourceApi({ data: ['BBBB'] }),
  C: new MockDataSourceApi({ data: ['CCCC'] }),
});

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => {
    return datasourceSrv;
  },
}));

const dummyStream: DataSourceStream = {
  onStreamProgress: (full: PanelData, partial: PanelData, subscription?: Unsubscribable) => {
    console.log('DUMMY');
  },
};

describe('MixedDatasource', () => {
  it('direct query should return results', async () => {
    const request = getQueryOptions({
      targets: [{ refId: 'QA', datasource: 'A' }, { refId: 'QB', datasource: 'B' }, { refId: 'QC', datasource: 'C' }],
    });

    const ds = await getDatasourceSrv().get('A');
    const res = await ds.query(request, dummyStream);
    expect(res.data[0]).toEqual('AAAA');
  });
});
