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

describe('dashboardEdit journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('dashboard_edit');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./dashboardEdit');
    });
  }

  it('should start journey when edit button is clicked', () => {
    loadWiring();

    simulateInteraction('dashboards_edit_button_clicked', {
      dashboardUid: 'abc123',
      outlineExpanded: false,
    });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'dashboard_edit',
      expect.objectContaining({
        attributes: expect.objectContaining({
          dashboardUID: 'abc123',
        }),
      })
    );
  });

  it('should end journey with success when dashboard is saved', () => {
    loadWiring();

    // Start journey
    simulateInteraction('dashboards_edit_button_clicked', { dashboardUid: 'abc123' });

    // Save dashboard
    simulateInteraction('grafana_dashboard_saved', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should end journey with success when new dashboard is created', () => {
    loadWiring();

    // Start journey
    simulateInteraction('dashboards_edit_button_clicked', { dashboardUid: '' });

    // Create dashboard
    simulateInteraction('grafana_dashboard_created', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should end journey with discarded when edit is discarded', () => {
    loadWiring();

    // Start journey
    simulateInteraction('dashboards_edit_button_clicked', { dashboardUid: 'abc123' });

    // Discard edit
    simulateInteraction('dashboards_edit_discarded', {});

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  // The wiring no longer guards end() with isActive - it trusts the idempotent
  // end() contract. On the real handle a second end() is a no-op; Faro sees only
  // one journey_complete measurement per journey. This test now just verifies
  // the happy path: one save -> one end('success').
  it('should end exactly once on save', () => {
    loadWiring();

    simulateInteraction('dashboards_edit_button_clicked', { dashboardUid: 'abc123' });
    simulateInteraction('grafana_dashboard_saved', {});

    expect(mockHandle.end).toHaveBeenCalledTimes(1);
    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });
});
