import { LegacyGraphHoverClearEvent } from '@grafana/data';
import { behaviors, sceneGraph, SceneTimeRange } from '@grafana/scenes';
import { DashboardCursorSync } from '@grafana/schema';

import appEvents from 'app/core/app_events';
import { KeybindingSet } from 'app/core/services/KeybindingSet';

import { DashboardScene } from './DashboardScene';
import { setupKeyboardShortcuts } from './keyboardShortcuts';

// Mock dependencies
jest.mock('app/core/app_events', () => ({
  subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
  publish: jest.fn(),
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
});
