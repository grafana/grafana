import { toDataFrame, FieldType } from '@grafana/data';

import { DummySearcher } from './dummy';
import { FrontendSearcher } from './frontend';

describe('FrontendSearcher', () => {
  const upstream = new DummySearcher();
  upstream.setExpectedSearchResult(
    toDataFrame({
      meta: {
        custom: {
          something: 8,
        },
      },
      fields: [{ name: 'name', type: FieldType.string, values: ['1', '2', '3'] }],
    })
  );

  it('should call search api with correct query for general folder', async () => {
    const frontendSearcher = new FrontendSearcher(upstream);
    const query = {
      query: '*',
      kind: ['dashboard'],
      location: 'General',
      sort: 'name_sort',
    };
    const results = await frontendSearcher.search(query);

    expect(results.view.fields.name.values.toArray()).toMatchInlineSnapshot(`
      Array [
        "1",
        "2",
        "3",
      ]
    `);
  });

  /*
  it('should call search api with correct query based on its kinds', async () => {
    searchMock.mockResolvedValue([]);

    const frontEndSearcher = new FrontendSearcher(new BlugeSearcher(new SQLSearcher()));

    const query = {
      query: '*',
      kind: ['folder'],
      location: 'any',
      sort: 'name_sort',
    };

    await frontEndSearcher.search(query);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search-v2', {
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

    await frontEndSearcher.search(query2);

    expect(searchMock).toHaveBeenLastCalledWith('/api/search-v2', {
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
*/
});
