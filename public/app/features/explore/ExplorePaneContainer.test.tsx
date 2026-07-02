import { act, renderHook } from '@testing-library/react';

import { useSelector } from 'app/types/store';

import { usePruneQueryFlowRefIds } from './ExplorePaneContainer';

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(),
}));

// `ExplorePaneContainer` imports the full `Explore` component tree at module scope, which pulls in
// a large, unrelated dependency graph — stub it out so this file only exercises the pruning hook.
jest.mock('./Explore', () => ({ __esModule: true, default: () => null }));
jest.mock('./ExploreQueryInspector', () => ({ __esModule: true, default: () => null }));

function mockQueryRefIds(refIds: string[]) {
  (useSelector as jest.Mock).mockImplementation((selector) =>
    selector({ explore: { panes: { left: { queries: refIds.map((refId) => ({ refId })) } } } })
  );
}

function mockPanes(panes: Record<string, string[]>) {
  (useSelector as jest.Mock).mockImplementation((selector) =>
    selector({
      explore: {
        panes: Object.fromEntries(
          Object.entries(panes).map(([exploreId, refIds]) => [
            exploreId,
            { queries: refIds.map((refId) => ({ refId })) },
          ])
        ),
      },
    })
  );
}

describe('usePruneQueryFlowRefIds', () => {
  it('drops an open refId once its query row no longer exists', () => {
    mockQueryRefIds(['A', 'B']);
    const setQueryFlowRefIds = jest.fn();
    const { rerender } = renderHook(() => usePruneQueryFlowRefIds('left', setQueryFlowRefIds));

    // Simulate the current open state (as if the user had opened both A and B) and query B being
    // removed from the pane.
    const updater = setQueryFlowRefIds.mock.calls.at(-1)?.[0];
    expect(updater(['A', 'B'])).toEqual(['A', 'B']); // Nothing to prune yet.

    mockQueryRefIds(['A']);
    rerender();

    const latestUpdater = setQueryFlowRefIds.mock.calls.at(-1)?.[0];
    expect(latestUpdater(['A', 'B'])).toEqual(['A']);
  });

  it('does not call the updater again when the set of refIds is unchanged', () => {
    mockQueryRefIds(['A']);
    const setQueryFlowRefIds = jest.fn();
    const { rerender } = renderHook(() => usePruneQueryFlowRefIds('left', setQueryFlowRefIds));
    expect(setQueryFlowRefIds).toHaveBeenCalledTimes(1);

    // Re-render with the exact same refId set — the memoized selector key doesn't change, so the
    // effect shouldn't re-run.
    mockQueryRefIds(['A']);
    rerender();
    expect(setQueryFlowRefIds).toHaveBeenCalledTimes(1);
  });

  it('returns the same array reference when nothing needs pruning (avoids an extra re-render)', () => {
    mockQueryRefIds(['A', 'B']);
    const setQueryFlowRefIds = jest.fn();
    renderHook(() => usePruneQueryFlowRefIds('left', setQueryFlowRefIds));

    const updater = setQueryFlowRefIds.mock.calls[0][0];
    const prev = ['A', 'B'];
    expect(updater(prev)).toBe(prev);
  });

  it('prunes every open refId when the pane has no queries at all', () => {
    mockQueryRefIds([]);
    const setQueryFlowRefIds = jest.fn();
    renderHook(() => usePruneQueryFlowRefIds('left', setQueryFlowRefIds));

    const updater = setQueryFlowRefIds.mock.calls[0][0];
    act(() => {
      expect(updater(['A', 'B'])).toEqual([]);
    });
  });

  it('prunes each split-view pane independently (scoped by exploreId, not shared state)', () => {
    // Left pane lost query B; right pane still has both of its queries — pruning must only affect
    // the pane whose queries actually changed.
    mockPanes({ left: ['A'], right: ['C', 'D'] });
    const setLeftRefIds = jest.fn();
    const setRightRefIds = jest.fn();
    renderHook(() => usePruneQueryFlowRefIds('left', setLeftRefIds));
    renderHook(() => usePruneQueryFlowRefIds('right', setRightRefIds));

    const leftUpdater = setLeftRefIds.mock.calls[0][0];
    const rightUpdater = setRightRefIds.mock.calls[0][0];
    expect(leftUpdater(['A', 'B'])).toEqual(['A']);
    expect(rightUpdater(['C', 'D'])).toEqual(['C', 'D']);
  });
});
