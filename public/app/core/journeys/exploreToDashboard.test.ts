import type { JourneyHandle, JourneyTracker } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/JourneyRegistryImpl';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockTracker,
  setupJourneyTest,
} from './__test-utils__/journeyTestHarness';


jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    onInteraction: (name: string, callback: (properties: Record<string, unknown>) => void) => {
      let set = interactionCallbacks.get(name);
      if (!set) {
        set = new Set();
        interactionCallbacks.set(name, set);
      }
      set.add(callback);
      return () => {
        set!.delete(callback);
        if (set!.size === 0) {
          interactionCallbacks.delete(name);
        }
      };
    },
  };
});

describe('exploreToDashboard journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('explore_to_dashboard');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./exploreToDashboard');
    });
  }

  it('should start journey when add-to-dashboard form opens', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'explore_to_dashboard',
      expect.objectContaining({
        attributes: expect.objectContaining({
          source: 'explore',
        }),
      })
    );
  });

  it('should add submit step with attributes on form submission', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});
    simulateInteraction('e_2_d_submit', {
      saveTarget: 'existing-dashboard',
      newTab: false,
      queries: [],
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('submit', {
      saveTarget: 'existing-dashboard',
      newTab: 'false',
    });
    expect(mockHandle.setAttributes).toHaveBeenCalledWith({
      saveTarget: 'existing-dashboard',
      newTab: 'false',
    });
  });

  it('should end journey with success when panel is applied', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});
    simulateInteraction('e_2_d_submit', { saveTarget: 'new-dashboard', newTab: false });
    simulateInteraction('explore_to_dashboard_panel_applied', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should end journey with discarded when form is closed without submit', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});
    simulateInteraction('e_2_d_discarded', {});

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  // The wiring no longer guards end() with isActive - it trusts the idempotent
  // end() contract. The real handle no-ops on subsequent ends.
  it('should end exactly once on panel applied', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});
    simulateInteraction('explore_to_dashboard_panel_applied', {});

    expect(mockHandle.end).toHaveBeenCalledTimes(1);
    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should handle newTab: true in submit attributes', () => {
    loadWiring();

    simulateInteraction('e_2_d_open', {});
    simulateInteraction('e_2_d_submit', {
      saveTarget: 'new-dashboard',
      newTab: true,
      queries: [{ refId: 'A' }],
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('submit', {
      saveTarget: 'new-dashboard',
      newTab: 'true',
    });
    expect(mockHandle.setAttributes).toHaveBeenCalledWith({
      saveTarget: 'new-dashboard',
      newTab: 'true',
    });
  });
});
