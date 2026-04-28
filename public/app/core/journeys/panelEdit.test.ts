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

describe('panelEdit journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('panel_edit');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./panelEdit');
    });
  }

  it('should start journey when panel edit action is clicked', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', {
      item: 'edit',
      id: 42,
      source: 'panel',
    });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'panel_edit',
      expect.objectContaining({
        attributes: expect.objectContaining({
          panelId: '42',
          source: 'panel',
        }),
      })
    );
  });

  it('should not start journey for non-edit panel actions', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', {
      item: 'duplicate',
      id: 42,
      source: 'panel',
    });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('should record steps for all panel edit interaction types', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', { item: 'edit', id: 1 });

    simulateInteraction('grafana_panel_edit_next_interaction', {
      action: 'add_query',
      source: 'new_query',
      card_source: 'section_header',
    });
    simulateInteraction('grafana_panel_edit_next_interaction', {
      action: 'add_transformation_initiated',
      source: 'inline',
    });
    simulateInteraction('grafana_panel_edit_next_interaction', {
      action: 'change_sidebar_view',
      view: 'overrides',
    });
    simulateInteraction('grafana_panel_edit_next_interaction', {
      action: 'reorder',
      item_type: 'query',
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledTimes(4);
    expect(mockHandle.recordEvent).toHaveBeenCalledWith('add_query', {
      source: 'new_query',
      card_source: 'section_header',
    });
    expect(mockHandle.recordEvent).toHaveBeenCalledWith('add_transformation', {
      source: 'inline',
    });
    expect(mockHandle.recordEvent).toHaveBeenCalledWith('change_view', {
      view: 'overrides',
    });
    expect(mockHandle.recordEvent).toHaveBeenCalledWith('reorder');
  });

  it('should end journey with success when panel edit closes', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', { item: 'edit', id: 1 });

    simulateInteraction('panel_edit_closed', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  // The wiring no longer guards calls with isActive - it trusts the idempotent
  // end() contract on the real handle. The mock handle doesn't enforce
  // no-op-after-end, so we only verify end is called exactly once per close event.
  it('should end exactly once on panel_edit_closed', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', { item: 'edit', id: 1 });

    simulateInteraction('panel_edit_closed', {});

    expect(mockHandle.end).toHaveBeenCalledTimes(1);
  });

  it('should end journey with discarded when panel_edit_discarded fires before close', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', { item: 'edit', id: 1 });

    // Discard fires before close
    simulateInteraction('panel_edit_discarded', {});
    simulateInteraction('panel_edit_closed', {});

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  it('should end journey with success when close fires without prior discard', () => {
    loadWiring();

    simulateInteraction('dashboards_panel_action_clicked', { item: 'edit', id: 1 });

    // Close without discard
    simulateInteraction('panel_edit_closed', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });
});
