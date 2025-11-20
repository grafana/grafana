import { LegacyGraphHoverClearEvent } from '@grafana/data';
import { config } from '@grafana/runtime';
import { behaviors, sceneGraph, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { KeybindingSet } from 'app/core/services/KeybindingSet';

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
const mockOnRefresh = jest.fn();
jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneGraph: {
    getTimeRange: jest.fn(() => ({
      onRefresh: mockOnRefresh,
    })),
  },
}));

describe('setupKeyboardShortcuts', () => {
  let mockScene: DashboardScene;
  let mockKeybindingSet: jest.Mocked<KeybindingSet>;
  let mockCursorSync: behaviors.CursorSync;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnRefresh.mockClear();

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

    it('should setup zoom out shortcut (t z)', () => {
      const tzBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't z');
      expect(tzBinding).toBeDefined();
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

  describe('edit mode shortcuts', () => {
    beforeEach(() => {
      jest.spyOn(mockScene, 'canEditDashboard').mockReturnValue(true);
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
  });

  describe('time range zoom shortcuts with feature toggle', () => {
    describe('when newTimeRangeZoomShortcuts is enabled', () => {
      beforeEach(() => {
        config.featureToggles.newTimeRangeZoomShortcuts = true;
        jest.clearAllMocks();
      });

      it('should setup t + zoom in shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        expect(tPlusBinding).toBeDefined();
      });

      it('should setup t - zoom out shortcut with keypress type', () => {
        setupKeyboardShortcuts(mockScene);

        const tMinusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't -');
        expect(tMinusBinding).toBeDefined();
        expect(tMinusBinding![0].type).toBe('keypress');
      });

      it('should not setup t z shortcut when feature toggle is on', () => {
        setupKeyboardShortcuts(mockScene);

        const tzBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't z');
        expect(tzBinding).toBeUndefined();
      });
    });

    describe('when newTimeRangeZoomShortcuts is disabled', () => {
      beforeEach(() => {
        config.featureToggles.newTimeRangeZoomShortcuts = false;
        jest.clearAllMocks();
      });

      it('should setup legacy t z shortcut', () => {
        setupKeyboardShortcuts(mockScene);

        const tzBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't z');
        expect(tzBinding).toBeDefined();
      });

      it('should not setup new zoom shortcuts when feature toggle is off', () => {
        setupKeyboardShortcuts(mockScene);

        const tPlusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't +');
        const tMinusBinding = mockKeybindingSet.addBinding.mock.calls.find((call) => call[0].key === 't -');

        expect(tPlusBinding).toBeUndefined();
        expect(tMinusBinding).toBeUndefined();
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
        config.featureToggles.newTimeRangeZoomShortcuts = true;
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
});
