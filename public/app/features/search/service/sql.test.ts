import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardSearchItemType } from '../types';

import { SQLSearcher } from './sql';

const searchMock = jest.spyOn(backendSrv, 'get');
jest.spyOn(backendSrv, 'fetch');

describe('SQLSearcher', () => {
  beforeEach(() => {
    searchMock.mockReset();
  });
  it('should call search api with correct query for general folder', async () => {
    searchMock.mockResolvedValue([]);
    const sqlSearcher = new SQLSearcher();
    const query = {
      query: '*',
      kind: ['dashboard'],
      location: 'General',
      sort: 'name_sort',
    };
    await sqlSearcher.search(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query.sort,
      tag: undefined,
      type: DashboardSearchItemType.DashDB,
      folderIds: [0],
    });
  });

  it('should call search api with correct query based on its kinds', async () => {
    searchMock.mockResolvedValue([]);

    const sqlSearcher = new SQLSearcher();

    const query = {
      query: '*',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
    };

    await sqlSearcher.search(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query.sort,
      tag: undefined,
      type: DashboardSearchItemType.DashFolder,
      folderIds: [0],
    });

    searchMock.mockClear();

    const query2 = {
      query: 'test',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
    };

    await sqlSearcher.search(query2);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query2.sort,
      query: query2.query,
      tag: undefined,
      folderIds: [0],
    });

    searchMock.mockClear();

    const query3 = {
      query: 'test',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
      uid: ['T202C0Tnk'],
    };

    await sqlSearcher.search(query3);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query3.sort,
      query: query3.query,
      tag: undefined,
      dashboardUID: query3.uid,
    });
  });

  it('starred should call search api with correct query', async () => {
    searchMock.mockResolvedValue([]);

    const sqlSearcher = new SQLSearcher();

    const query = {
      query: 'test',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
      uid: ['T202C0Tnk'],
      starred: true,
    };

    await sqlSearcher.starred(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query.sort,
      query: query.query,
      tag: undefined,
      dashboardUID: query.uid,
      starred: true,
    });
  });
});
