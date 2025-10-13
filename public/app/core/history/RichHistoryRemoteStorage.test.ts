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

// FIXME: Tests break unless plugin loader is mocked. This is likely due to a circular dependency
jest.mock('app/features/plugins/plugin_loader', () => ({}));

describe('RichHistoryRemoteStorage', () => {
  let storage: RichHistoryRemoteStorage;

  beforeEach(() => {
    fetchMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    patchMock.mockReset();
    storage = new RichHistoryRemoteStorage();
  });

  const setup = (): {
    richHistoryQuery: RichHistoryQuery;
    richHistoryStarredQuery: RichHistoryQuery;
    dto: RichHistoryRemoteStorageDTO;
    dtoStarred: RichHistoryRemoteStorageDTO;
  } => {
    const richHistoryQuery: RichHistoryQuery = {
      id: '123',
      createdAt: 200 * 1000,
      datasourceUid: 'ds1',
      datasourceName: 'name-of-ds1',
      starred: true,
      comment: 'comment',
      queries: [{ refId: 'foo' }],
    };

    const richHistoryStarredQuery: RichHistoryQuery = {
      ...richHistoryQuery,
      starred: false,
    };

    const dto = {
      uid: richHistoryQuery.id,
      createdAt: richHistoryQuery.createdAt / 1000,
      datasourceUid: richHistoryQuery.datasourceUid,
      starred: richHistoryQuery.starred,
      comment: richHistoryQuery.comment,
      queries: richHistoryQuery.queries,
    };

    const dtoStarred = {
      ...dto,
      starred: richHistoryStarredQuery.starred,
    };

    return {
      richHistoryQuery,
      richHistoryStarredQuery,
      dto,
      dtoStarred,
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
    const starred = false;
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

    expect(fetchMock).toHaveBeenCalledWith({
      method: 'GET',
      url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&to=${to}&from=${from}&limit=${expectedLimit}&page=${expectedPage}`,
      requestId: 'query-history-get-all',
    });
    expect(richHistory).toMatchObject([richHistoryQuery]);
    expect(total).toBe(1);
  });

  it('returns list of all starred query history items', async () => {
    const { richHistoryStarredQuery, dtoStarred } = setup();
    const returnedDTOs: RichHistoryRemoteStorageDTO[] = [dtoStarred];

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
      from,
      to,
    });

    expect(fetchMock).toHaveBeenCalledWith({
      method: 'GET',
      url: `/api/query-history?datasourceUid=ds1&datasourceUid=ds2&searchString=${search}&sort=time-desc&limit=${expectedLimit}&page=${expectedPage}&onlyStarred=${starred}`,
      requestId: 'query-history-get-starred',
    });
    expect(richHistory).toMatchObject([richHistoryStarredQuery]);
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
      activeDatasourcesOnly: false,
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
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: false,
    });
  });

  it('updates user settings', async () => {
    await storage.updateSettings({
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: false,
    });
    expect(preferencesServiceMock.patch).toHaveBeenCalledWith({
      queryHistory: { homeTab: 'query' },
    } as Partial<UserPreferencesDTO>);

    await storage.updateSettings({
      activeDatasourcesOnly: false,
      lastUsedDatasourceFilters: undefined,
      retentionPeriod: 14,
      starredTabAsFirstTab: true,
    });
    expect(preferencesServiceMock.patch).toHaveBeenCalledWith({
      queryHistory: { homeTab: 'starred' },
    } as Partial<UserPreferencesDTO>);
  });

  it('stars query history items', async () => {
    const { richHistoryQuery, dto } = setup();
    postMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateStarred('test', true);
    expect(postMock).toHaveBeenCalledWith('/api/query-history/star/test');
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('unstars query history items', async () => {
    const { richHistoryQuery, dto } = setup();
    deleteMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateStarred('test', false);
    expect(deleteMock).toHaveBeenCalledWith('/api/query-history/star/test');
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('updates query history comments', async () => {
    const { richHistoryQuery, dto } = setup();
    patchMock.mockResolvedValue({
      result: dto,
    });
    const query = await storage.updateComment('test', 'just a comment');
    expect(patchMock).toHaveBeenCalledWith('/api/query-history/test', {
      comment: 'just a comment',
    });
    expect(query).toMatchObject(richHistoryQuery);
  });

  it('deletes query history items', async () => {
    await storage.deleteRichHistory('test');
    expect(deleteMock).toHaveBeenCalledWith('/api/query-history/test');
  });
});
