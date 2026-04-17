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

describe('datasourceConfigure journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('datasource_configure');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./datasourceConfigure');
    });
  }

  it('should start journey when add datasource is clicked', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'datasource_configure',
      expect.objectContaining({
        attributes: expect.objectContaining({
          pluginId: 'prometheus',
          source: 'catalog',
        }),
      })
    );
  });

  it('should add save_config step when datasource is configured', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    simulateInteraction('connections_datasources_ds_configured', { item: 'basic' });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('save_config');
  });

  it('should add test_failed step when test fails (boolean false)', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: false,
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('test_failed');
    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('should end journey with success when test succeeds (boolean true)', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: true,
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should end journey with success when test succeeds (string "true")', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: 'true',
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should track multiple test failures before success', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'loki',
      datasource_uid: 'ds-uid-2',
    });

    // First failure
    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: false,
      plugin_id: 'loki',
      datasource_uid: 'ds-uid-2',
    });

    // Second failure
    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: false,
      plugin_id: 'loki',
      datasource_uid: 'ds-uid-2',
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledTimes(2);
    expect(mockHandle.recordEvent).toHaveBeenNthCalledWith(1, 'test_failed');
    expect(mockHandle.recordEvent).toHaveBeenNthCalledWith(2, 'test_failed');
    expect(mockHandle.end).not.toHaveBeenCalled();

    // Success
    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: true,
      plugin_id: 'loki',
      datasource_uid: 'ds-uid-2',
    });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should not add steps or end after journey is already ended', () => {
    loadWiring();

    simulateInteraction('grafana_ds_add_datasource_clicked', {
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    // End the journey
    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: true,
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    // Mark handle as inactive
    Object.defineProperty(mockHandle, 'isActive', { value: false, writable: true });

    // These should be no-ops
    simulateInteraction('connections_datasources_ds_configured', { item: 'basic' });
    simulateInteraction('grafana_ds_test_datasource_clicked', {
      success: false,
      plugin_id: 'prometheus',
      datasource_uid: 'ds-uid-1',
    });

    expect(mockHandle.end).toHaveBeenCalledTimes(1);
    expect(mockHandle.recordEvent).not.toHaveBeenCalled();
  });

});
