import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DataStreamEvent, DataStreamEventObserver } from '@grafana/ui';
import { MixedDatasource } from './MixedDatasource';

const defaultDS = new MockDataSourceApi({ data: ['A', 'B'] }, 'DefaultDS');
const datasourceSrv = new DatasourceSrvMock(defaultDS, {
  A: new MockDataSourceApi({ data: ['AAAA'] }, 'DSA'),
  B: new MockDataSourceApi({ data: ['BBBB'] }, 'DSB'),
  C: new MockDataSourceApi({ data: ['CCCC'] }, 'DSC'),
});

jest.mock('app/features/plugins/datasource_srv', () => ({
  getDatasourceSrv: () => {
    return datasourceSrv;
  },
}));

const dummyStream: DataStreamEventObserver = {
  next: (event: DataStreamEvent) => {
    console.log('DUMMY');
    return true;
  },
};

describe('MixedDatasource', () => {
  const request = getQueryOptions({
    targets: [{ refId: 'QA', datasource: 'A' }, { refId: 'QB', datasource: 'B' }, { refId: 'QC', datasource: 'C' }],
  });

  it('direct query should return results', async () => {
    const ds = await getDatasourceSrv().get('A');
    const res = await ds.query(request, dummyStream);
    expect(res.data[0]).toEqual('AAAA');
  });

  it('direct query should return results', async () => {
    const ds = new MixedDatasource();
    const res = await ds.query(request, dummyStream);
    expect(res.data.length).toEqual(3);
  });
});
