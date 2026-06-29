import { renderHook } from '@testing-library/react';

import { dateTime, type TimeRange } from '@grafana/data';
import { SceneTimeRange, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { useControlledRefresh, useControlledTimeRange } from './EmbeddedDashboard';

function buildScene() {
  return new DashboardScene({
    title: 'embedded',
    uid: 'embedded-1',
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
  });
}

function makeTimeRange(from: string, to: string): TimeRange {
  return { from: dateTime(), to: dateTime(), raw: { from, to } };
}

describe('useControlledTimeRange', () => {
  it('pushes the controlled time range into the embedded dashboard when active', () => {
    const model = buildScene();

    renderHook(() => useControlledTimeRange(makeTimeRange('now-1h', 'now'), model, true));

    expect(sceneGraph.getTimeRange(model).state.from).toBe('now-1h');
    expect(sceneGraph.getTimeRange(model).state.to).toBe('now');
  });

  it('does nothing while the dashboard is not active', () => {
    const model = buildScene();
    const onTimeRangeChange = jest.spyOn(sceneGraph.getTimeRange(model), 'onTimeRangeChange');

    renderHook(() => useControlledTimeRange(makeTimeRange('now-1h', 'now'), model, false));

    expect(onTimeRangeChange).not.toHaveBeenCalled();
    expect(sceneGraph.getTimeRange(model).state.from).toBe('now-6h');
  });
});

describe('useControlledRefresh', () => {
  it('refreshes when the token changes but not on initial mount', () => {
    const model = buildScene();
    const onRefresh = jest.spyOn(sceneGraph.getTimeRange(model), 'onRefresh');

    const { rerender } = renderHook(({ token }) => useControlledRefresh(token, model, true), {
      initialProps: { token: 0 },
    });

    // Initial token value must not trigger a refresh (would double-run queries on mount).
    expect(onRefresh).not.toHaveBeenCalled();

    rerender({ token: 1 });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Re-rendering with the same token does not refresh again.
    rerender({ token: 1 });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing while the dashboard is not active', () => {
    const model = buildScene();
    const onRefresh = jest.spyOn(sceneGraph.getTimeRange(model), 'onRefresh');

    const { rerender } = renderHook(({ token }) => useControlledRefresh(token, model, false), {
      initialProps: { token: 0 },
    });
    rerender({ token: 1 });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
