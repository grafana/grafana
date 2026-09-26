import { act, render, screen, waitFor } from 'test/test-utils';

import { dateTime, type TimeRange } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneGridLayout, SceneTimeRange, sceneGraph } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
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

  it.each([false, true])('switches embedded tabs without host navigation or reload (nested: %s)', async (nested) => {
    const tabs = new TabsLayoutManager({
      tabs: [new TabItem({ title: 'Overview' }), new TabItem({ title: 'Details' })],
    });
    const model = buildScene();
    model.setState({
      meta: { isEmbedded: true },
      body: nested ? new TabsLayoutManager({ tabs: [new TabItem({ title: 'Parent', layout: tabs })] }) : tabs,
    });
    mockStateManager.useState.mockReturnValue({ dashboard: model });
    const onStateChange = jest.fn();
    const { user } = await act(async () =>
      render(<EmbeddedDashboard uid="embedded-1" onStateChange={onStateChange} />)
    );
    const hostLocation = locationService.getLocation();
    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Details' }));

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    expect(onStateChange).toHaveBeenCalledWith(
      expect.stringContaining(nested ? 'Parent-dtab=Details' : 'dtab=Details')
    );
    expect(locationService.getLocation()).toEqual(hostLocation);
    expect(mockStateManager.loadDashboard).toHaveBeenCalledTimes(1);
    expect(mockStateManager.clearState).not.toHaveBeenCalled();
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
