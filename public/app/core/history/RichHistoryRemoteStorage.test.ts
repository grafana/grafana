import { of } from 'rxjs';

import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

import { DatasourceSrv } from '../../features/plugins/datasource_srv';
import { RichHistoryQuery } from '../../types';
import { SortOrder } from '../utils/richHistoryTypes';

import RichHistoryRemoteStorage, { RichHistoryRemoteStorageDTO } from './RichHistoryRemoteStorage';

const dsMock = new DatasourceSrv();
dsMock.init(
  {
    // @ts-ignore
    'name-of-ds1': { uid: 'ds1', name: 'name-of-ds1' },
    // @ts-ignore
    'name-of-ds2': { uid: 'ds2', name: 'name-of-ds2' },
  },
  ''
);

const fetchMock = jest.fn();
const postMock = jest.fn();
const deleteMock = jest.fn();
const patchMock = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    fetch: fetchMock,
    post: postMock,
    delete: deleteMock,
    patch: patchMock,
  }),
  getDataSourceSrv: () => dsMock,
}));

const preferencesServiceMock = {
  patch: jest.fn(),
  load: jest.fn(),
};
jest.mock('../services/PreferencesService', () => ({
  PreferencesService: function () {
    return preferencesServiceMock;
  },
}));

describe('RichHistoryRemoteStorage', () => {
  let storage: RichHistoryRemoteStorage;

  beforeEach(() => {
    fetchMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    patchMock.mockReset();
    storage = new RichHistoryRemoteStorage();
  });

  const setup = (): { richHistoryQuery: RichHistoryQuery; dto: RichHistoryRemoteStorageDTO } => {
    const richHistoryQuery: RichHistoryQuery = {
      id: '123',
      createdAt: 200 * 1000,
      datasourceUid: 'ds1',
      datasourceName: 'name-of-ds1',
      starred: true,
      comment: 'comment',
      queries: [{ refId: 'foo' }],
    };

    const dto = {
      uid: richHistoryQuery.id,
      createdAt: richHistoryQuery.createdAt / 1000,
      datasourceUid: richHistoryQuery.datasourceUid,
      starred: richHistoryQuery.starred,
      comment: richHistoryQuery.comment,
      queries: richHistoryQuery.queries,
    };

    return {
      richHistoryQuery,
      dto,
    };
  };

  it('returns list of query history items', async () => {
    const { richHistoryQuery, dto } = setup();
    const returnedDTOs: RichHistoryRemoteStorageDTO[] = [dto];
    fetchMock.mockReturnValue(
      of({
        data: {
          result: {
            queryHistory: returnedDTOs,
            totalCount: returnedDTOs.length,
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

    const { richHistory, total } = await storage.getRichHistory({
      search,
      datasourceFilters,
      sortOrder,
      starred,
      to,
      from,
    });

    expect(fetchMock).toBeCalledWith({
      method: 'GET',
      url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&to=now-${from}d&from=now-${to}d&limit=${expectedLimit}&page=${expectedPage}&onlyStarred=${starred}`,
      requestId: 'query-history-get-all',
    });
    expect(richHistory).toMatchObject([richHistoryQuery]);
    expect(total).toBe(1);
  });

  it('read starred home tab preferences', async () => {
    preferencesServiceMock.load.mockResolvedValue({
      queryHistory: {
        homeTab: 'starred',
      },
    } as UserPreferencesDTO);
    const settings = await storage.getSettings();
    expect(settings).toMatchObject({
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: true,
    });
  });

  it('uses default home tab preferences', async () => {
    preferencesServiceMock.load.mockResolvedValue({
      queryHistory: {
        homeTab: '',
      },
    } as UserPreferencesDTO);
    const settings = await storage.getSettings();
    expect(settings).toMatchObject({
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: false,
    });
  });

  it('updates user settings', async () => {
    await storage.updateSettings({
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: false,
    });
    expect(preferencesServiceMock.patch).toBeCalledWith({
      queryHistory: { homeTab: 'query' },
    } as Partial<UserPreferencesDTO>);

    await storage.updateSettings({
      activeDatasourceOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: true,
    });
    expect(preferencesServiceMock.patch).toBeCalledWith({
      queryHistory: { homeTab: 'starred' },
    } as Partial<UserPreferencesDTO>);
  });

  it('migrates provided rich history items', async () => {
    const { richHistoryQuery, dto } = setup();
    fetchMock.mockReturnValue(of({}));
    await storage.migrate([richHistoryQuery]);
    expect(fetchMock).toBeCalledWith({
      url: '/api/query-history/migrate',
      method: 'POST',
      data: { queries: [dto] },
      showSuccessAlert: false,
    });
  });

  it('stars query history items', async () => {
    const { richHistoryQuery, dto } = setup();
    postMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateStarred('test', true);
    expect(postMock).toBeCalledWith('/api/query-history/star/test');
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('unstars query history items', async () => {
    const { richHistoryQuery, dto } = setup();
    deleteMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateStarred('test', false);
    expect(deleteMock).toBeCalledWith('/api/query-history/star/test');
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('updates query history comments', async () => {
    const { richHistoryQuery, dto } = setup();
    patchMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateComment('test', 'just a comment');
    expect(patchMock).toBeCalledWith('/api/query-history/test', {
      comment: 'just a comment',
    });
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('deletes query history items', async () => {
    await storage.deleteRichHistory('test');
    expect(deleteMock).toBeCalledWith('/api/query-history/test');
  });
});
