import { createBrowserHistory } from 'history';

import { type GrafanaConfig, LegacyGraphHoverClearEvent, locationUtil, SetPanelAttentionEvent } from '@grafana/data';
import { config, HistoryWrapper, locationService, setLocationService } from '@grafana/runtime';
import { behaviors, sceneGraph, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { appEvents } from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { KeybindingSet } from 'app/core/services/KeybindingSet';
import { contextSrv } from 'app/core/services/context_srv';
import { mockLocalStorage } from 'app/features/alerting/unified/mocks';

import { buildPanelEditScene } from '../panel-edit/PanelEditor';
import { buildShareUrl } from '../sharing/ShareButton/utils';
import { DashboardInteractions } from '../utils/interactions';
import { findVizPanelByPathId } from '../utils/pathId';
import { tryGetExploreUrlForPanel } from '../utils/urlBuilders';

import { DashboardScene } from './DashboardScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';

// Mock dependencies
jest.mock('app/core/app_events', () => ({
  appEvents: {
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    publish: jest.fn(),
  },
}));
jest.mock('app/core/services/KeybindingSet');
jest.mock('../sharing/ShareButton/utils');
jest.mock('../utils/pathId', () => ({
  findVizPanelByPathId: jest.fn(),
}));
jest.mock('../utils/urlBuilders', () => ({
  ...jest.requireActual('../utils/urlBuilders'),
  tryGetExploreUrlForPanel: jest.fn(),
}));
const mockOnRefresh = jest.fn();
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    getTimeRange: jest.fn(() => ({
      onRefresh: mockOnRefresh,
    })),
  },
}));

const localStorageMock = mockLocalStorage();
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('setupKeyboardShortcuts', () => {
  let mockScene: DashboardScene;
  let mockKeybindingSet: jest.Mocked<KeybindingSet>;
  let mockCursorSync: behaviors.CursorSync;

  function getBinding(key: string) {
    return mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === key)?.[0];
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnRefresh.mockClear();
    localStorageMock.clear();

    // Mock KeybindingSet
    mockKeybindingSet = jest.mocked(new KeybindingSet());
    jest.spyOn(mockKeybindingSet, 'addBinding').mockImplementation();
    jest.spyOn(mockKeybindingSet, 'removeAll').mockImplementation();
    (KeybindingSet as jest.Mock).mockImplementation(() => mockKeybindingSet);

    // Create mock CursorSync behavior
    mockCursorSync = new behaviors.CursorSync({ sync: DashboardCursorSync.Off });
    jest.spyOn(mockCursorSync, 'setState');

    // Create mock DashboardScene
    mockScene = new DashboardScene({
      title: 'Test Dashboard',
      uid: 'test-uid',
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      $behaviors: [mockCursorSync],
    });

    // Mock canEditDashboard
    jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    setTestFlags({});
  });

  it('should setup keyboard shortcuts and return cleanup function', () => {
    const cleanup = setupKeyboardShortcuts(mockScene);

    expect(KeybindingSet).toHaveBeenCalled();
    expect(mockKeybindingSet.addBinding).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');

    // Call cleanup function
    cleanup();
    expect(mockKeybindingSet.removeAll).toHaveBeenCalled();
  });

  it('keeps panel editing available without registering the obsolete Preview shortcut', () => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
    try {
      setupKeyboardShortcuts(mockScene);
      const keys = mockKeybindingSet.addBinding.mock.calls.map(([binding]) => binding.key);
      expect(keys).toContain('e');
      expect(keys).not.toContain('d p');
    } finally {
      setTestFlags({});
    }
  });

  describe('mod+o shortcut (toggle shared crosshair)', () => {
    let modOHandler: () => void;

    beforeEach(() => {
      setupKeyboardShortcuts(mockScene);

      // Find the mod+o binding
      const modOBinding = getBinding('mod+o');
      expect(modOBinding).toBeDefined();
      modOHandler = modOBinding!.onTrigger;
    });

    it('should toggle cursor sync from Off to Crosshair', () => {
      // Initial state: Off (0)
      mockCursorSync.setState({ sync: DashboardCursorSync.Off });

      modOHandler();

      expect(mockCursorSync.setState).toHaveBeenCalledWith({ sync: DashboardCursorSync.Crosshair });
      expect(appEvents.publish).toHaveBeenCalledWith(expect.any(LegacyGraphHoverClearEvent));
      expect(sceneGraph.getTimeRange).toHaveBeenCalledWith(mockScene);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('should toggle cursor sync from Crosshair to Tooltip', () => {
      // Initial state: Crosshair (1)
      mockCursorSync.setState({ sync: DashboardCursorSync.Crosshair });
      jest.clearAllMocks();

      modOHandler();

      expect(mockCursorSync.setState).toHaveBeenCalledWith({ sync: DashboardCursorSync.Tooltip });
      expect(appEvents.publish).toHaveBeenCalledWith(expect.any(LegacyGraphHoverClearEvent));
      expect(sceneGraph.getTimeRange).toHaveBeenCalledWith(mockScene);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it('should toggle cursor sync from Tooltip to Off', () => {
      // Initial state: Tooltip (2)
      mockCursorSync.setState({ sync: DashboardCursorSync.Tooltip });
      jest.clearAllMocks();

      modOHandler();

      expect(mockCursorSync.setState).toHaveBeenCalledWith({ sync: DashboardCursorSync.Off });
      expect(appEvents.publish).toHaveBeenCalledWith(expect.any(LegacyGraphHoverClearEvent));
      expect(sceneGraph.getTimeRange).toHaveBeenCalledWith(mockScene);
      expect(mockOnRefresh).toHaveBeenCalled();
    });

    it.each(['view', 'composer'] as const)('should toggle cursor sync in %s mode', (mode) => {
      setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
      mockScene.setState({ mode, isEditing: mode === 'composer' });
      mockCursorSync.setState({ sync: DashboardCursorSync.Off });

      modOHandler();

      expect(mockCursorSync.setState).toHaveBeenCalledWith({ sync: DashboardCursorSync.Crosshair });
    });

    it('should handle missing CursorSync behavior gracefully', () => {
      // Create scene without CursorSync behavior by overriding state
      const sceneWithoutCursorSync = new DashboardScene({
        title: 'Test Dashboard',
        uid: 'test-uid',
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });

      // Force remove CursorSync behavior
      sceneWithoutCursorSync.setState({ $behaviors: [] });
      jest.clearAllMocks();

      setupKeyboardShortcuts(sceneWithoutCursorSync);

      const modOBinding = getBinding('mod+o');
      const handler = modOBinding!.onTrigger;

      // Should not throw error when CursorSync is missing
      expect(() => handler()).not.toThrow();
      // When CursorSync is missing, no state changes or refresh should happen
      expect(sceneGraph.getTimeRange).not.toHaveBeenCalled();
    });

    it('should handle non-CursorSync behavior gracefully', () => {
      // Create scene with different behavior type
      const sceneWithOtherBehavior = new DashboardScene({
        title: 'Test Dashboard',
        uid: 'test-uid',
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      });

      // Force set only non-CursorSync behavior
      sceneWithOtherBehavior.setState({ $behaviors: [new behaviors.LiveNowTimer({ enabled: false })] });
      jest.clearAllMocks();

      setupKeyboardShortcuts(sceneWithOtherBehavior);

      const modOBinding = getBinding('mod+o');
      const handler = modOBinding!.onTrigger;

      // Should not throw error when CursorSync is not found
      expect(() => handler()).not.toThrow();
      // When CursorSync is not found, no state changes or refresh should happen
      expect(sceneGraph.getTimeRange).not.toHaveBeenCalled();
    });
  });

  describe('other keyboard shortcuts', () => {
    beforeEach(() => {
      setupKeyboardShortcuts(mockScene);
    });

    it('should setup view panel shortcut (v)', () => {
      expect(getBinding('v')).toBeDefined();
    });

    it('should setup refresh shortcut (d r)', () => {
      expect(getBinding('d r')).toBeDefined();
    });

    it('should setup zoom out shortcut (ctrl+z)', () => {
      expect(getBinding('ctrl+z')).toBeDefined();
    });

    it('should setup time range shortcuts', () => {
      expect(getBinding('t a')).toBeDefined();
      expect(getBinding('t left')).toBeDefined();
      expect(getBinding('t right')).toBeDefined();
    });
  });

  describe('p u shortcut (copy panel share link)', () => {
    let puHandler: () => void;
    let focusedPanel: VizPanel;

    beforeEach(() => {
      focusedPanel = new VizPanel({ pluginId: 'timeseries' });
      jest.mocked(findVizPanelByPathId).mockReturnValue(focusedPanel);
      jest.spyOn(mockScene, 'showModal');

      setupKeyboardShortcuts(mockScene);

      // Simulate a panel gaining focus so withFocusedPanel resolves a panel.
      const attentionHandler = jest.mocked(appEvents.subscribe).mock.calls[0][1];
      attentionHandler(new SetPanelAttentionEvent({ panelId: 'panel-1' }));

      const puBinding = getBinding('p u');
      expect(puBinding).toBeDefined();
      puHandler = puBinding!.onTrigger;
    });

    it('should copy the panel share link for the focused panel', async () => {
      await puHandler();

      expect(buildShareUrl).toHaveBeenCalledWith(mockScene, focusedPanel);
    });

    it('should not open a modal (drawer)', async () => {
      await puHandler();

      expect(mockScene.showModal).not.toHaveBeenCalled();
    });

    it('should do nothing when no panel is focused', async () => {
      jest.clearAllMocks();
      // Re-setup without dispatching a panel attention event.
      setupKeyboardShortcuts(mockScene);
      await getBinding('p u')!.onTrigger();

      expect(buildShareUrl).not.toHaveBeenCalled();
    });
  });

  describe('while planning', () => {
    // None of 'p u'/'p e'/'p s'/'i' check isEditing anywhere in their own chain -- each is
    // reachable during a plan preview by construction, so refuseWhilePlanning covers them here.
    let focusedPanel: VizPanel;

    beforeEach(() => {
      focusedPanel = new VizPanel({ pluginId: 'timeseries' });
      jest.mocked(findVizPanelByPathId).mockReturnValue(focusedPanel);
      jest.spyOn(mockScene, 'showModal');
      config.snapshotEnabled = true;
      contextSrv.isSignedIn = true;
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

      mockScene.setState({
        planning: { phase: 'preview', planId: 'plan-1', planTitle: 'Plan', onBuild: () => {}, onDismiss: () => {} },
      });
      setupKeyboardShortcuts(mockScene);

      const attentionHandler = jest.mocked(appEvents.subscribe).mock.calls[0][1];
      attentionHandler(new SetPanelAttentionEvent({ panelId: 'panel-1' }));
    });

    it('refuses the panel share link (p u)', async () => {
      await getBinding('p u')!.onTrigger();
      expect(buildShareUrl).not.toHaveBeenCalled();
    });

    it('refuses share embed (p e) and share snapshot (p s)', async () => {
      await getBinding('p e')!.onTrigger();
      await getBinding('p s')!.onTrigger();
      expect(mockScene.showModal).not.toHaveBeenCalled();
    });

    it('refuses panel inspect (i)', async () => {
      await getBinding('i')!.onTrigger();
      expect(mockScene.showModal).not.toHaveBeenCalled();
    });
  });

  it.each([
    { mode: 'view' as const, editable: true, fullscreen: false },
    { mode: 'view' as const, editable: true, fullscreen: true },
    { mode: 'view' as const, editable: false, fullscreen: false },
    { mode: 'view' as const, editable: false, fullscreen: true },
    { mode: 'agent' as const, editable: true, fullscreen: false },
    { mode: 'agent' as const, editable: true, fullscreen: true },
    { mode: 'agent' as const, editable: false, fullscreen: false },
    { mode: 'agent' as const, editable: false, fullscreen: true },
  ])(
    'panel edit shortcut enters Editing from $mode only when editable=$editable (fullscreen=$fullscreen)',
    async ({ mode, editable, fullscreen }) => {
      setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
      try {
        const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
        mockScene.setState({
          mode,
          isEditing: true,
          editable,
          viewPanel: fullscreen ? 'panel-1' : undefined,
          body: DefaultGridLayoutManager.fromVizPanels([panel]),
        });
        jest.mocked(findVizPanelByPathId).mockReturnValue(panel);
        locationService.replace(fullscreen ? '/d/test-uid?viewPanel=panel-1' : '/d/test-uid');
        setupKeyboardShortcuts(mockScene);
        const attentionHandler = jest.mocked(appEvents.subscribe).mock.calls[0][1];
        attentionHandler(new SetPanelAttentionEvent({ panelId: 'panel-1' }));
        await getBinding('e')!.onTrigger();
        expect(mockScene.state.mode).toBe(editable ? 'edit' : mode);
        expect(locationService.getSearchObject().editPanel).toBe(editable ? '1' : undefined);
        expect(locationService.getSearchObject().viewPanel).toBe(fullscreen && !editable ? 'panel-1' : undefined);
      } finally {
        setTestFlags({});
      }
    }
  );

  it.each([
    { mode: 'view' as const, editable: true },
    { mode: 'view' as const, editable: false },
    { mode: 'agent' as const, editable: true },
    { mode: 'agent' as const, editable: false },
  ])('dashboard settings shortcut enters Editing from $mode only when editable=$editable', ({ mode, editable }) => {
    setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
    try {
      mockScene.setState({ mode, isEditing: true, editable });
      locationService.replace('/d/test-uid');
      setupKeyboardShortcuts(mockScene);
      const binding = mockKeybindingSet.addBinding.mock.calls.find(([binding]) => binding.key === 'd s')![0];
      binding.onTrigger();
      expect(mockScene.state.mode).toBe(editable ? 'edit' : mode);
      expect(locationService.getSearchObject().editview).toBe(editable ? 'settings' : undefined);
    } finally {
      setTestFlags({});
    }
  });

  describe('navigation when Grafana is served from a sub-path', () => {
    const originalLocationService = locationService;
    let panel: VizPanel;
    let scene: DashboardScene;

    beforeEach(() => {
      locationUtil.initialize({
        config: { appSubUrl: '/grafana' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
      // Mirrors production: the router's browser history applies the sub-path itself.
      window.history.replaceState({}, '', '/grafana/d/test-uid?editPanel=1');
      setLocationService(new HistoryWrapper(createBrowserHistory({ basename: '/grafana' })));

      panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries' });
      scene = new DashboardScene({
        title: 'Test Dashboard',
        uid: 'test-uid',
        body: DefaultGridLayoutManager.fromVizPanels([panel]),
      });
      jest.spyOn(scene, 'canEditDashboard').mockReturnValue(true);
      jest.mocked(findVizPanelByPathId).mockReturnValue(panel);

      setupKeyboardShortcuts(scene);
      const attentionHandler = jest.mocked(appEvents.subscribe).mock.calls[0][1];
      attentionHandler(new SetPanelAttentionEvent({ panelId: 'panel-1' }));
    });

    afterEach(() => {
      setLocationService(originalLocationService);
      window.history.replaceState({}, '', '/');
      locationUtil.initialize({
        config: { appSubUrl: '' } as GrafanaConfig,
        getTimeRangeForUrl: jest.fn(),
        getVariablesUrlParams: jest.fn(),
      });
    });

    it('opens Explore (p x) with the sub-path in the browser URL exactly once', async () => {
      // tryGetExploreUrlForPanel returns an href, which already carries the sub-path.
      jest.mocked(tryGetExploreUrlForPanel).mockResolvedValue('/grafana/explore?schemaVersion=1');

      await getBinding('p x')!.onTrigger();

      expect(window.location.pathname).toBe('/grafana/explore');
      expect(window.location.search).toBe('?schemaVersion=1');
    });

    it('exits panel edit (e) with the sub-path in the browser URL exactly once', async () => {
      scene.setState({ editPanel: buildPanelEditScene(panel) });

      await getBinding('e')!.onTrigger();

      expect(window.location.pathname).toBe('/grafana/d/test-uid');
      expect(window.location.search).toBe('');
    });
  });

  describe('edit mode shortcuts', () => {
    beforeEach(() => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
      mockScene.setState({ meta: { ...mockScene.state.meta, canSave: true } });
      setupKeyboardShortcuts(mockScene);
    });

    it('should setup edit panel shortcut (e) when can edit', () => {
      expect(getBinding('e')).toBeDefined();
    });

    it('should setup save shortcut (mod+s) when can edit', () => {
      expect(getBinding('mod+s')).toBeDefined();
    });

    it.each([
      { mode: 'view', opens: false },
      { mode: 'edit', opens: true },
      { mode: 'agent', opens: true },
    ] as const)('save shortcut (mod+s) opens the save drawer in $mode mode: $opens', ({ mode, opens }) => {
      setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
      mockScene.setState({ mode, isEditing: true });
      const openSaveDrawer = jest.spyOn(mockScene, 'openSaveDrawer').mockResolvedValue(undefined);
      const modSBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+s');

      modSBinding![0].onTrigger();

      expect(openSaveDrawer).toHaveBeenCalledTimes(opens ? 1 : 0);
    });

    it('should setup dashboard settings shortcut (d s) when can edit', () => {
      expect(getBinding('d s')).toBeDefined();
    });
  });

  describe('non-edit mode', () => {
    beforeEach(() => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(false);
      setupKeyboardShortcuts(mockScene);
    });

    it('should not setup edit-only shortcuts when cannot edit', () => {
      expect(getBinding('e')).toBeUndefined();
      expect(getBinding('mod+s')).toBeUndefined();
      expect(getBinding('d s')).toBeUndefined();
    });

    it('should still setup non-edit shortcuts when cannot edit', () => {
      expect(getBinding('mod+o')).toBeDefined();
      expect(getBinding('v')).toBeDefined();
      expect(getBinding('d r')).toBeDefined();
    });

    it('should setup collapse/expand all rows shortcuts when cannot edit', () => {
      expect(getBinding('d shift+c')).toBeDefined();
      expect(getBinding('d shift+e')).toBeDefined();
    });
  });

  describe('edit mode shortcuts, blocked on mobile', () => {
    afterEach(() => {
      setTestFlags({});
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    });

    it('does not set up the e/mod+s/d s shortcuts when blocked on mobile, even if canEditDashboard', () => {
      setTestFlags({ 'grafana.mobileEditDeprecation': true });
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
      mockScene.setState({ meta: { ...mockScene.state.meta, canSave: true } });

      setupKeyboardShortcuts(mockScene);

      expect(getBinding('e')).toBeUndefined();
      expect(getBinding('mod+s')).toBeUndefined();
      expect(getBinding('d s')).toBeUndefined();
    });

    it('sets up the e/mod+s/d s shortcuts normally when not blocked on mobile', () => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
      mockScene.setState({ meta: { ...mockScene.state.meta, canSave: true } });

      setupKeyboardShortcuts(mockScene);

      expect(getBinding('e')).toBeDefined();
      expect(getBinding('mod+s')).toBeDefined();
      expect(getBinding('d s')).toBeDefined();
    });
  });

  describe('p c shortcut (copy panel), blocked on mobile', () => {
    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    });

    it('sets up the copy-panel shortcut when not blocked on mobile', () => {
      setupKeyboardShortcuts(mockScene);

      expect(getBinding('p c')).toBeDefined();
    });

    it('does not set up the copy-panel shortcut when blocked on mobile', () => {
      setTestFlags({ 'grafana.mobileEditDeprecation': true });
      Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

      setupKeyboardShortcuts(mockScene);

      expect(getBinding('p c')).toBeUndefined();
    });
  });

  describe('time range zoom shortcuts', () => {
    describe('zoom key bindings', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should setup t + zoom in shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        expect(getBinding('t +')).toBeDefined();
      });

      it('should setup t = zoom in shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        expect(getBinding('t =')).toBeDefined();
      });

      it('should setup t - zoom out shortcut with keypress type', () => {
        setupKeyboardShortcuts(mockScene);

        const tMinusBinding = getBinding('t -');
        expect(tMinusBinding).toBeDefined();
        expect(tMinusBinding!.type).toBe('keypress');
      });

      it('should not setup t z shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        expect(getBinding('t z')).toBeUndefined();
      });
    });

    describe('zoom handler logic', () => {
      let mockTimeRange: ReturnType<typeof createMockTimeRange>;

      function createMockTimeRange() {
        return {
          state: {
            value: {
              from: { valueOf: () => new Date('2024-01-01 12:00:00').getTime() },
              to: { valueOf: () => new Date('2024-01-01 18:00:00').getTime() }, // 6 hour span
              raw: { from: 'now-6h', to: 'now' },
            },
          },
          onTimeRangeChange: jest.fn(),
        } satisfies {
          state: {
            value: {
              from: { valueOf: () => number };
              to: { valueOf: () => number };
              raw: { from: string; to: string };
            };
          };
          onTimeRangeChange: jest.Mock;
        };
      }

      beforeEach(() => {
        mockTimeRange = createMockTimeRange();

        (sceneGraph.getTimeRange as jest.Mock).mockReturnValue(mockTimeRange);
        jest.clearAllMocks();
      });

      it('should zoom in (scale 0.5) when t + is pressed', () => {
        setupKeyboardShortcuts(mockScene);

        const handler = getBinding('t +')!.onTrigger;

        handler();

        // Scale 0.5 should result in 3 hour span (half of 6)
        expect(mockTimeRange.onTimeRangeChange).toHaveBeenCalledWith(
          expect.objectContaining({
            from: expect.any(Object),
            to: expect.any(Object),
            raw: expect.any(Object),
          })
        );

        const call = mockTimeRange.onTimeRangeChange.mock.calls[0][0];
        const newSpan = call.to.valueOf() - call.from.valueOf();
        expect(newSpan).toBe(3 * 60 * 60 * 1000); // 3 hours in milliseconds
      });

      it('should zoom in (scale 0.5) when t = is pressed', () => {
        setupKeyboardShortcuts(mockScene);

        const handler = getBinding('t =')!.onTrigger;

        handler();

        // Scale 0.5 should result in 3 hour span (half of 6)
        expect(mockTimeRange.onTimeRangeChange).toHaveBeenCalledWith(
          expect.objectContaining({
            from: expect.any(Object),
            to: expect.any(Object),
            raw: expect.any(Object),
          })
        );

        const call = mockTimeRange.onTimeRangeChange.mock.calls[0][0];
        const newSpan = call.to.valueOf() - call.from.valueOf();
        expect(newSpan).toBe(3 * 60 * 60 * 1000); // 3 hours in milliseconds
      });

      it('should keep center point when zooming in', () => {
        setupKeyboardShortcuts(mockScene);

        const handler = getBinding('t +')!.onTrigger;

        const originalCenter = (mockTimeRange.state.value.from.valueOf() + mockTimeRange.state.value.to.valueOf()) / 2;

        handler();

        const call = mockTimeRange.onTimeRangeChange.mock.calls[0][0];
        const newCenter = (call.from.valueOf() + call.to.valueOf()) / 2;

        expect(newCenter).toBe(originalCenter);
      });

      it('should do nothing when timespan is zero', () => {
        mockTimeRange.state.value.from.valueOf = () => new Date('2024-01-01 12:00:00').getTime();
        mockTimeRange.state.value.to.valueOf = () => new Date('2024-01-01 12:00:00').getTime(); // Same time

        setupKeyboardShortcuts(mockScene);

        const handler = getBinding('t +')!.onTrigger;

        handler();

        // Should not call onTimeRangeChange when timespan is 0
        expect(mockTimeRange.onTimeRangeChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('copy/paste panel shortcuts', () => {
    // Simulate the user hovering/focusing a panel by firing the SetPanelAttentionEvent
    // that setupKeyboardShortcuts subscribes to (appEvents is mocked, so no event actually flows).
    function focusPanel(pathId: string) {
      const attentionHandler = jest.mocked(appEvents.subscribe).mock.calls[0][1];
      attentionHandler(new SetPanelAttentionEvent({ panelId: pathId }));
    }

    describe('registration', () => {
      it('registers the copy panel shortcut (p c)', () => {
        setupKeyboardShortcuts(mockScene);
        expect(getBinding('p c')).toBeDefined();
      });

      it('registers the paste panel shortcut (p v) when editing is allowed', () => {
        jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
        setupKeyboardShortcuts(mockScene);
        expect(getBinding('p v')).toBeDefined();
      });

      it('does not register the paste panel shortcut (p v) when editing is not allowed', () => {
        jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(false);
        setupKeyboardShortcuts(mockScene);
        expect(getBinding('p v')).toBeUndefined();
      });
    });

    describe('copy panel (p c)', () => {
      let panel: VizPanel;

      beforeEach(() => {
        panel = new VizPanel({ key: 'panel-1', pluginId: 'table' });
        jest.mocked(findVizPanelByPathId).mockReturnValue(panel);
        jest.spyOn(mockScene, 'copyPanel').mockImplementation();
        jest.spyOn(DashboardInteractions, 'panelActionClicked').mockImplementation();
      });

      it('copies the focused panel', () => {
        setupKeyboardShortcuts(mockScene);
        focusPanel('panel-1');

        getBinding('p c')!.onTrigger();

        expect(mockScene.copyPanel).toHaveBeenCalledWith(panel);
      });

      it('reports the copy interaction as keyboard-sourced', () => {
        setupKeyboardShortcuts(mockScene);
        focusPanel('panel-1');

        getBinding('p c')!.onTrigger();

        expect(DashboardInteractions.panelActionClicked).toHaveBeenCalledWith('copy', expect.any(Number), 'keyboard');
      });

      it('does nothing when no panel is focused', () => {
        setupKeyboardShortcuts(mockScene);

        getBinding('p c')!.onTrigger();

        expect(mockScene.copyPanel).not.toHaveBeenCalled();
      });
    });

    describe('paste panel (p v)', () => {
      beforeEach(() => {
        jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
        jest.spyOn(mockScene, 'pastePanel').mockImplementation();
        jest.spyOn(DashboardInteractions, 'trackPastePanelClick').mockImplementation();
      });

      it('pastes a panel while editing', () => {
        mockScene.setState({ isEditing: true });
        localStorageMock.setItem(LS_PANEL_COPY_KEY, JSON.stringify({ panelId: 'panel-1' }));
        setupKeyboardShortcuts(mockScene);

        getBinding('p v')!.onTrigger();

        expect(mockScene.pastePanel).toHaveBeenCalledTimes(1);
        expect(DashboardInteractions.trackPastePanelClick).toHaveBeenCalledWith('keyboard', 'dashboard', 'keyboard');
      });

      it('ignores paste in Viewing and enables the same shortcut after returning to Editing', () => {
        setTestFlags({ dashboardNewLayouts: true, 'grafana.dashboardPreviewMode': true });
        mockScene.setState({ isEditing: true, mode: 'view' });
        localStorageMock.setItem(LS_PANEL_COPY_KEY, JSON.stringify({ panelId: 'panel-1' }));
        setupKeyboardShortcuts(mockScene);

        getBinding('p v')!.onTrigger();
        expect(mockScene.pastePanel).not.toHaveBeenCalled();

        mockScene.setState({ mode: 'edit' });
        getBinding('p v')!.onTrigger();
        expect(mockScene.pastePanel).toHaveBeenCalledTimes(1);
      });

      it('does not paste when not editing', () => {
        mockScene.setState({ isEditing: false });
        setupKeyboardShortcuts(mockScene);

        getBinding('p v')!.onTrigger();

        expect(mockScene.pastePanel).not.toHaveBeenCalled();
      });
    });
  });
});
