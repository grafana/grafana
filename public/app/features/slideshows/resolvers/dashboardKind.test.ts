import { type DataFrameView } from '@grafana/data';

import { getGrafanaSearcher } from '../../search/service/searcher';
import { type DashboardQueryResult, type GrafanaSearcher } from '../../search/service/types';

import { dashboardKind } from './dashboardKind';

jest.mock('../../search/service/searcher');

const search = jest.fn();

function viewOf(rows: Array<Partial<DashboardQueryResult>>) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const view = {
    length: rows.length,
    // Like a real DataFrameView, which hands back an empty row object for an out-of-range index.
    get: (i: number) => rows[i] ?? {},
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  };
  return { view } as unknown as { view: DataFrameView<DashboardQueryResult> };
}

describe('dashboardKind', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    jest.mocked(getGrafanaSearcher).mockReturnValue({ search } as unknown as GrafanaSearcher);
  });

  it('identifies the dashboard resource', () => {
    expect(dashboardKind).toMatchObject({ group: 'dashboard.grafana.app', resource: 'dashboards' });
  });

  it('resolves a uid to the url and title the search service reports', async () => {
    search.mockResolvedValue(viewOf([{ uid: 'cpu', name: 'CPU overview', url: '/d/cpu/cpu-overview' }]));

    await expect(dashboardKind.resolve('cpu')).resolves.toEqual({ url: '/d/cpu/cpu-overview', title: 'CPU overview' });
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ kind: ['dashboard'], uid: ['cpu'] }));
  });

  it('returns undefined for a uid the search service does not know', async () => {
    search.mockResolvedValue(viewOf([]));

    await expect(dashboardKind.resolve('gone')).resolves.toBeUndefined();
  });

  it('searches dashboards by text and maps the rows to names and titles', async () => {
    search.mockResolvedValue(
      viewOf([
        { uid: 'a', name: 'Alpha', url: '/d/a/alpha' },
        { uid: 'b', name: 'Beta', url: '/d/b/beta' },
      ])
    );

    await expect(dashboardKind.search('a', 20)).resolves.toEqual([
      { name: 'a', title: 'Alpha' },
      { name: 'b', title: 'Beta' },
    ]);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: 'a', kind: ['dashboard'], limit: 20 }));
  });

  it('lists everything when the text is empty', async () => {
    search.mockResolvedValue(viewOf([]));

    await dashboardKind.search('', 20);

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ query: '*' }));
  });
});
