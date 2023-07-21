import { backendSrv } from 'app/core/services/backend_srv';

import { DashboardSearchItemType } from '../types';

import { SQLSearcher } from './sql';

const searchMock = jest.spyOn(backendSrv, 'get');
jest.spyOn(backendSrv, 'fetch');

describe('SQLSearcher', () => {
  beforeEach(() => {
    searchMock.mockReset();
    searchMock.mockResolvedValue([]);
  });

  it('should call search api with correct query for general folder', async () => {
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

  it('should call search api with correct folder kind when searching for *', async () => {
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
  });

  it('should call search api with correct folder kind when searching for a specific term', async () => {
    const sqlSearcher = new SQLSearcher();

    const query = {
      query: 'test',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
    };

    await sqlSearcher.search(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query.sort,
      query: query.query,
      tag: undefined,
      type: DashboardSearchItemType.DashFolder,
      folderIds: [0],
    });
  });

  it('should call search api with correct folder kind when searching with a specific uid', async () => {
    const sqlSearcher = new SQLSearcher();

    const query = {
      query: 'test',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
      uid: ['T202C0Tnk'],
    };

    await sqlSearcher.search(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
      limit: 1000,
      sort: query.sort,
      query: query.query,
      tag: undefined,
      dashboardUID: query.uid,
      type: DashboardSearchItemType.DashFolder,
    });
  });

  it('starred should call search api with correct query', async () => {
    const sqlSearcher = new SQLSearcher();

    const query = {
      query: 'test',
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

  describe('pagination', () => {
    it.each([
      { from: undefined, expectedPage: undefined },
      { from: 0, expectedPage: 1 },
      { from: 50, expectedPage: 2 },
      { from: 150, expectedPage: 4 },
    ])('should search page $expectedPage when skipping $from results', async ({ from, expectedPage }) => {
      const sqlSearcher = new SQLSearcher();

      await sqlSearcher.search({
        query: '*',
        kind: ['dashboard'],
        from,
        limit: 50,
      });

      expect(searchMock).toHaveBeenLastCalledWith('/api/search', {
        limit: 50,
        page: expectedPage,
        sort: undefined,
        tag: undefined,
        type: 'dash-db',
      });
    });
  });
});
