import { RichHistoryQuery } from '../../types';
import { of } from 'rxjs';

import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryRemoteStorage, { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';
import { DataSourceSrvMock } from './RichHistoryStorage';

const fetchMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
  }),
  getDataSourceSrv: () => DataSourceSrvMock,
}));

describe('RichHistoryRemoteStorage', () => {
  let storage: RichHistoryRemoteStorage;

  beforeEach(() => {
    fetchMock.mockReset();

    storage = new RichHistoryRemoteStorage();
  });

  it('returns list of query history items', async () => {
    const expectedViewModel: RichHistoryQuery<any> = {
      id: '123',
      createdAt: 200 * 1000,
      datasourceUid: 'uid',
      datasourceName: 'name-of-uid',
      starred: true,
      comment: 'comment',
      queries: [{ foo: 'bar ' }],
    };
    const returnedDTOs: RichHistoryRemoteStorageDTO[] = [
      {
        uid: expectedViewModel.id,
        createdAt: expectedViewModel.createdAt / 1000,
        datasourceUid: expectedViewModel.datasourceUid,
        starred: expectedViewModel.starred,
        comment: expectedViewModel.comment,
        queries: expectedViewModel.queries,
      },
    ];
    const search = 'foo';
    const datasourceFilters = ['name-of-uid1', 'name-of-uid2'];
    fetchMock.mockReturnValue(
      of({
        data: {
          result: {
            queryHistory: returnedDTOs,
          },
        },
      })
    );
    const search = 'foo';
    const datasourceFilters = ['name-of-ds1', 'name-of-ds2'];
    const sortOrder = SortOrder.Descending;
    const starred = true;
    const from = 100;
    const to = 200;
    const expectedLimit = 100;
    const expectedPage = 1;

    const items = await storage.getRichHistory({ search, datasourceFilters, sortOrder, starred, to, from });

    expect(fetchMock).toBeCalledWith({
      method: 'GET',
      url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&to=now-${from}d&from=now-${to}d&limit=${expectedLimit}&page=${expectedPage}&onlyStarred=${starred}`,
      requestId: 'query-history-get-all',
    });
    expect(items).toMatchObject([expectedViewModel]);
  });
});
