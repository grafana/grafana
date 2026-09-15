import { LegacyGraphHoverClearEvent, SetPanelAttentionEvent } from '@grafana/data';
import { behaviors, sceneGraph, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { LS_PANEL_COPY_KEY } from 'app/core/constants';
import { KeybindingSet } from 'app/core/services/KeybindingSet';
import { mockLocalStorage } from 'app/features/alerting/unified/mocks';

import { buildShareUrl } from '../sharing/ShareButton/utils';
import { DashboardInteractions } from '../utils/interactions';
import { findVizPanelByPathId } from '../utils/pathId';

import { DashboardScene } from './DashboardScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

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

  describe('mod+o shortcut (toggle shared crosshair)', () => {
    let modOHandler: () => void;

    beforeEach(() => {
      setupKeyboardShortcuts(mockScene);

      // Find the mod+o binding
      const modOBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+o');
      expect(modOBinding).toBeDefined();
      modOHandler = modOBinding![0].onTrigger;
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

      const modOBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+o');
      const handler = modOBinding![0].onTrigger;

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

      const modOBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+o');
      const handler = modOBinding![0].onTrigger;

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
      const vBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'v');
      expect(vBinding).toBeDefined();
    });

    it('should setup refresh shortcut (d r)', () => {
      const drBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd r');
      expect(drBinding).toBeDefined();
    });

    it('should setup zoom out shortcut (ctrl+z)', () => {
      const ctrlZBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'ctrl+z');
      expect(ctrlZBinding).toBeDefined();
    });

    it('should setup time range shortcuts', () => {
      const taBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't a');
      const tLeftBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't left');
      const tRightBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't right');

      expect(taBinding).toBeDefined();
      expect(tLeftBinding).toBeDefined();
      expect(tRightBinding).toBeDefined();
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

      const puBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'p u');
      expect(puBinding).toBeDefined();
      puHandler = puBinding![0].onTrigger;
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
      const puBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'p u');
      await puBinding![0].onTrigger();

      expect(buildShareUrl).not.toHaveBeenCalled();
    });
  });

  describe('edit mode shortcuts', () => {
    beforeEach(() => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
      mockScene.setState({ meta: { ...mockScene.state.meta, canSave: true } });
      setupKeyboardShortcuts(mockScene);
    });

    it('should setup edit panel shortcut (e) when can edit', () => {
      const eBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'e');
      expect(eBinding).toBeDefined();
    });

    it('should setup save shortcut (mod+s) when can edit', () => {
      const modSBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+s');
      expect(modSBinding).toBeDefined();
    });

    it('should setup dashboard settings shortcut (d s) when can edit', () => {
      const dsBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd s');
      expect(dsBinding).toBeDefined();
    });
  });

  describe('non-edit mode', () => {
    beforeEach(() => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(false);
      setupKeyboardShortcuts(mockScene);
    });

    it('should not setup edit-only shortcuts when cannot edit', () => {
      const eBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'e');
      const modSBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+s');
      const dsBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd s');

      expect(eBinding).toBeUndefined();
      expect(modSBinding).toBeUndefined();
      expect(dsBinding).toBeUndefined();
    });

    it('should still setup non-edit shortcuts when cannot edit', () => {
      const modOBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'mod+o');
      const vBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'v');
      const drBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd r');

      expect(modOBinding).toBeDefined();
      expect(vBinding).toBeDefined();
      expect(drBinding).toBeDefined();
    });

    it('should setup collapse/expand all rows shortcuts when cannot edit', () => {
      const collapseBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd shift+c');
      const expandBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 'd shift+e');

      expect(collapseBinding).toBeDefined();
      expect(expandBinding).toBeDefined();
    });
  });

  describe('time range zoom shortcuts', () => {
    describe('zoom key bindings', () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('should setup t + zoom in shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        expect(tPlusBinding).toBeDefined();
      });

      it('should setup t = zoom in shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        const tEqualsBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't =');
        expect(tEqualsBinding).toBeDefined();
      });

      it('should setup t - zoom out shortcut with keypress type', () => {
        setupKeyboardShortcuts(mockScene);

        const tMinusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't -');
        expect(tMinusBinding).toBeDefined();
        expect(tMinusBinding![0].type).toBe('keypress');
      });

      it('should not setup t z shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        const tzBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't z');
        expect(tzBinding).toBeUndefined();
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

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        const handler = tPlusBinding![0].onTrigger;

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

        const tEqualsBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't =');
        const handler = tEqualsBinding![0].onTrigger;

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

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        const handler = tPlusBinding![0].onTrigger;

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

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        const handler = tPlusBinding![0].onTrigger;

        handler();

        // Should not call onTimeRangeChange when timespan is 0
        expect(mockTimeRange.onTimeRangeChange).not.toHaveBeenCalled();
      });
    });
  });

  describe('copy/paste panel shortcuts', () => {
    const getBinding = (key: string) =>
      mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === key)?.[0];

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

      it('does not paste when not editing', () => {
        mockScene.setState({ isEditing: false });
        setupKeyboardShortcuts(mockScene);

        getBinding('p v')!.onTrigger();

        expect(mockScene.pastePanel).not.toHaveBeenCalled();
      });
    });
  });
});
