import { countUnder } from './useFolderSidebar';

const post = jest.fn();
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ post }),
}));

describe('countUnder', () => {
  beforeEach(() => post.mockReset());

  it('counts everything below the folder and facets on type in the same request', async () => {
    post.mockResolvedValue({ metadata: { totalHits: 0, totalHitsRelation: 'eq' }, items: [] });

    await countUnder('parent');

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({
      apiVersion: 'search.grafana.app/v0alpha1',
      kind: 'SearchQuery',
      where: { and: [{ filter: { field: 'folderTree', operator: 'In', values: ['parent'] } }] },
      facets: ['groupResource'],
      limit: 1,
    });
  });

  it('reports subfolders when folders are among the results below', async () => {
    post.mockResolvedValue({
      metadata: { totalHits: 7, totalHitsRelation: 'eq' },
      items: [],
      facets: {
        groupResource: [
          { value: 'dashboard.grafana.app/dashboards', count: 5 },
          { value: 'folder.grafana.app/folders', count: 2 },
        ],
      },
    });

    expect(await countUnder('parent')).toEqual({ count: 7, hasSubfolders: true });
  });

  it('reports no subfolders when only other types are below', async () => {
    post.mockResolvedValue({
      metadata: { totalHits: 4, totalHitsRelation: 'eq' },
      items: [],
      facets: { groupResource: [{ value: 'dashboard.grafana.app/dashboards', count: 4 }] },
    });

    expect(await countUnder('leaf')).toEqual({ count: 4, hasSubfolders: false });
  });
});
