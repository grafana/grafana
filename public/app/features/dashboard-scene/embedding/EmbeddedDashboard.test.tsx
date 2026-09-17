import { render, waitFor } from 'test/test-utils';

import { dateTime, type TimeRange } from '@grafana/data';
import { SceneGridLayout, SceneTimeRange, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { mockResizeObserver } from '../utils/test-utils';

import { EmbeddedDashboard } from './EmbeddedDashboard';

const mockStateManager = {
  useState: jest.fn(),
  loadDashboard: jest.fn(),
  clearState: jest.fn(),
};

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: () => mockStateManager,
}));

jest.mock('../utils/utils', () => ({
  ...jest.requireActual('../utils/utils'),
  useScenesFlickeringFix: jest.fn(),
}));

function buildScene() {
  return new DashboardScene({
    title: 'embedded',
    uid: 'embedded-1',
    meta: {},
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
  });
}

function makeTimeRange(from: string, to: string): TimeRange {
  return { from: dateTime(), to: dateTime(), raw: { from, to } };
}

describe('EmbeddedDashboard', () => {
  beforeAll(() => {
    mockResizeObserver();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('controlled timeRange', () => {
    it('syncs the time range into the embedded dashboard', async () => {
      const model = buildScene();
      mockStateManager.useState.mockReturnValue({ dashboard: model });
      const onTimeRangeChange = jest.spyOn(sceneGraph.getTimeRange(model), 'onTimeRangeChange');

      render(<EmbeddedDashboard uid="embedded-1" timeRange={makeTimeRange('now-1h', 'now')} />);

      await waitFor(() => expect(onTimeRangeChange).toHaveBeenCalledTimes(1));
      expect(sceneGraph.getTimeRange(model).state.from).toBe('now-1h');
      expect(sceneGraph.getTimeRange(model).state.to).toBe('now');
    });

    it('updates the time range when the prop changes', async () => {
      const model = buildScene();
      mockStateManager.useState.mockReturnValue({ dashboard: model });

      const { rerender } = render(<EmbeddedDashboard uid="embedded-1" timeRange={makeTimeRange('now-1h', 'now')} />);
      await waitFor(() => expect(sceneGraph.getTimeRange(model).state.from).toBe('now-1h'));

      rerender(<EmbeddedDashboard uid="embedded-1" timeRange={makeTimeRange('now-15m', 'now')} />);
      await waitFor(() => expect(sceneGraph.getTimeRange(model).state.from).toBe('now-15m'));
    });
  });

  describe('controlled refreshToken', () => {
    it('refreshes when the token changes but not on initial mount', async () => {
      const model = buildScene();
      mockStateManager.useState.mockReturnValue({ dashboard: model });
      const onRefresh = jest.spyOn(sceneGraph.getTimeRange(model), 'onRefresh');

      const { rerender } = render(<EmbeddedDashboard uid="embedded-1" refreshToken={0} />);
      // Initial token value must not trigger a refresh (would double-run queries on mount).
      await waitFor(() => expect(onRefresh).not.toHaveBeenCalled());

      rerender(<EmbeddedDashboard uid="embedded-1" refreshToken={1} />);
      await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));

      // Re-rendering with the same token does not refresh again.
      rerender(<EmbeddedDashboard uid="embedded-1" refreshToken={1} />);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });
});
