import { DatasourceSrvMock, MockDataSourceApi } from 'test/mocks/datasource_srv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getQueryOptions } from 'test/helpers/getQueryOptions';
import { DataStreamState, DataStreamObserver } from '@grafana/ui';
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

describe('MixedDatasource', () => {
  const request = getQueryOptions({
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
    const res = await ds.query(request, dummyStream);
    expect(res.data[0]).toEqual('AAAA');
    expect(counter).toBe(0);
    expect(lastEvent).toBeUndefined();
  });

  it('mixed query is async', async () => {
    let resolver: any;
    const waiter = new Promise((resolve, reject) => {
      resolver = resolve;
    });
    let counter = 0;
    const dummyStream: DataStreamObserver = (event: DataStreamState) => {
      if (++counter === request.targets.length) {
        resolver(event);
      }
    };

    const ds = new MixedDatasource();
    const res = await ds.query(request, dummyStream);
    expect(res.data.length).toBeFalsy();
    await waiter;
    expect(counter).toBe(3);
  });
});
