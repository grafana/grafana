import { act, renderHook } from 'test/test-utils';

import { type DashboardQueryResult } from '../search/service/types';

import { type PlaylistItemUI } from './types';
import { usePlaylistItems } from './usePlaylistItems';
import { loadDashboards } from './utils';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  loadDashboards: jest.fn(),
}));

const loadDashboardsMock = jest.mocked(loadDashboards);

const dash = (name: string) => [{ name } as DashboardQueryResult];

describe('usePlaylistItems', () => {
  it('attaches loaded dashboards to the right rows when items are reordered while loading', async () => {
    let resolveLoad: (items: PlaylistItemUI[]) => void = () => {};
    loadDashboardsMock.mockReturnValueOnce(new Promise((res) => (resolveLoad = res)));

    const a: PlaylistItemUI = { type: 'dashboard_by_uid', value: 'a' };
    const b: PlaylistItemUI = { type: 'dashboard_by_uid', value: 'b' };
    const { result } = renderHook(() => usePlaylistItems([a, b]));

    // Same length, different order: an index-based merge would swap the dashboards.
    act(() => result.current.moveItem(0, 1));
    loadDashboardsMock.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      resolveLoad([
        { ...a, dashboards: dash('A') },
        { ...b, dashboards: dash('B') },
      ]);
    });

    expect(result.current.items.map((i) => [i.value, i.dashboards?.[0].name])).toEqual([
      ['b', 'B'],
      ['a', 'A'],
    ]);
  });
});
