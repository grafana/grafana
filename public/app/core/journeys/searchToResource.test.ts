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

describe('searchToResource journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('search_to_resource');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./searchToResource');
    });
  }

  it('should start journey when command palette opens', () => {
    loadWiring();

    simulateInteraction('command_palette_opened', {});

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'search_to_resource',
      expect.objectContaining({
        attributes: expect.objectContaining({
          source: 'command_palette',
        }),
      })
    );
  });

  it('should set resource type when dashboard palette action is selected', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/dashboard/d/abc123/my-dashboard',
      actionName: 'My Dashboard',
    });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'dashboard',
        actionId: 'go/dashboard/d/abc123/my-dashboard',
      })
    );
  });

  it('should set resourceType to other for non-dashboard palette actions', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/alerting',
      actionName: 'Alerting',
    });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'other',
      })
    );
  });

  it('should set resourceType to folder for go/folder actions', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/folder/abc',
      actionName: 'My Folder',
    });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'folder',
        actionId: 'go/folder/abc',
      })
    );
  });

  it('should end journey with success on dashboards_init_dashboard_completed', () => {
    loadWiring();

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('dashboards_init_dashboard_completed', { uid: 'dash-1' });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should set resourceType to dashboard on dashboard load', () => {
    loadWiring();

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('dashboards_init_dashboard_completed', { uid: 'dash-1' });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'dashboard' })
    );
  });

  it('should end with success when folder action selected and browse page loads', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/folder/folder-uid-1',
      actionName: 'Reports',
    });

    simulateInteraction('grafana_browse_dashboards_page_view', {
      folderUID: 'folder-uid-1',
    });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ folderUID: 'folder-uid-1' })
    );
  });

  it('should end with success when nav action selected and palette closes', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'navModel.alerting',
      actionName: 'Alerting',
    });

    simulateInteraction('command_palette_closed', {});

    expect(mockHandle.end).toHaveBeenCalledWith('success');
  });

  it('should end with discarded when palette closes without action selection', () => {
    loadWiring();

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_closed', {});

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  it('should not end on palette close when dashboard action was selected (waits for load)', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/dashboard/d/abc123/my-dash',
      actionName: 'My Dash',
    });

    simulateInteraction('command_palette_closed', {});

    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('should not end on palette close when folder action was selected (waits for page_view)', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    simulateInteraction('command_palette_action_selected', {
      actionId: 'go/folder/some-folder',
      actionName: 'Some Folder',
    });

    simulateInteraction('command_palette_closed', {});

    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('should use startsWith for go/dashboard check, not includes', () => {
    loadWiring();
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);

    simulateInteraction('command_palette_opened', {});
    // An actionId that contains 'go/dashboard' but doesn't start with it
    simulateInteraction('command_palette_action_selected', {
      actionId: 'some-prefix/go/dashboard/d/abc',
      actionName: 'Tricky',
    });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'other',
      })
    );
  });
});
