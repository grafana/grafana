import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DataStreamState, DataStreamObserver } from '@grafana/ui';

const defaultDS = new MockDataSourceApi('DefaultDS', { data: ['A', 'B'] });
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  A: new MockDataSourceApi('DSA', { data: ['AAAA'] }),
  B: new MockDataSourceApi('DSB', { data: ['BBBB'] }),
  C: new MockDataSourceApi('DSC', { data: ['CCCC'] }),
});

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => {
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
    let counter = 0;
    let lastEvent: DataStreamState;
    const dummyStream: DataStreamObserver = (event: DataStreamState) => {
      lastEvent = event;
      counter++;
    };

    const ds = await getDatasourceSrv().get('A');
    const res = await ds.query(requestMixed, dummyStream);
    expect(res.data).toEqual(['AAAA', 'BBBB', 'CCCC']);
    expect(counter).toBe(0);
    expect(lastEvent).toBeUndefined();
  });
});
