import { act, renderHook, waitFor } from '@testing-library/react';

import { type DashboardQueryResult } from '../search/service/types';

import { type PlaylistItemUI } from './types';
import { usePlaylistItems } from './usePlaylistItems';
import { loadDashboards } from './utils';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  loadDashboards: jest.fn(),
}));

const loadDashboardsMock = jest.mocked(loadDashboards);

describe('usePlaylistItems', () => {
  it('merges an in-flight dashboard load into the correct items after reordering', async () => {
    let resolveInitialLoad!: (items: PlaylistItemUI[]) => void;
    loadDashboardsMock
      .mockImplementationOnce(
        () =>
          new Promise<PlaylistItemUI[]>((resolve) => {
            resolveInitialLoad = resolve;
          })
      )
      // The reorder starts another load. Keep it pending so this test specifically exercises
      // the stale first response rather than allowing the newer request to fix the result.
      .mockImplementationOnce(() => new Promise<PlaylistItemUI[]>(() => {}));

    const { result } = renderHook(() =>
      usePlaylistItems([
        { type: 'dashboard_by_uid', value: 'dashboard-a' },
        { type: 'dashboard_by_uid', value: 'dashboard-b' },
      ])
    );
    await waitFor(() => expect(loadDashboardsMock).toHaveBeenCalledTimes(1));
    const requestedItems = loadDashboardsMock.mock.calls[0][0];

    act(() => result.current.moveItem(0, 1));
    await waitFor(() => expect(loadDashboardsMock).toHaveBeenCalledTimes(2));
    act(() => {
      resolveInitialLoad(
        requestedItems.map((item) => ({
          ...item,
          dashboards: [{ uid: item.value, name: item.value } as DashboardQueryResult],
        }))
      );
    });

    await waitFor(() => expect(result.current.items.every((item) => item.dashboards)).toBe(true));
    expect(result.current.items.map((item) => [item.value, item.dashboards?.[0].uid])).toEqual([
      ['dashboard-b', 'dashboard-b'],
      ['dashboard-a', 'dashboard-a'],
    ]);
  });
});
