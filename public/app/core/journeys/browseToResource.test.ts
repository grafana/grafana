import type { JourneyHandle, JourneyTracker } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/JourneyRegistryImpl';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockStepHandle,
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

describe('browseToResource journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('browse_to_resource');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./browseToResource');
    });
  }

  it('should start journey on first grafana_browse_dashboards_page_view', () => {
    loadWiring();

    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'browse_to_resource',
      expect.objectContaining({
        attributes: expect.objectContaining({
          source: 'browse_dashboards',
          folderUID: '',
        }),
      })
    );
  });

  it('should not start a new journey on subsequent page_view when journey is active', () => {
    loadWiring();

    // First page_view starts the journey
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });
    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);

    // Subsequent page_view with active journey should NOT start a new one
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: 'folder-abc' });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockHandle.setAttributes).toHaveBeenCalledWith({ folderUID: 'folder-abc' });
  });

  it('should start navigate_folder step when folder item is clicked with active journey', () => {
    loadWiring();

    // Start the journey (triggers onJourneyInstance wiring)
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    simulateInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: 'folder',
      uid: 'folder-123',
    });

    expect(mockHandle.startStep).toHaveBeenCalledWith('navigate_folder', {
      folderUID: 'folder-123',
    });
  });

  it('should end navigate_folder step when page_view fires after folder click', () => {
    loadWiring();

    // Start the journey
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    const mockStepHandle = createMockStepHandle();
    mockHandle.startStep.mockReturnValue(mockStepHandle);

    // Click a folder
    simulateInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: 'folder',
      uid: 'folder-123',
    });

    // Folder loads (page_view fires)
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: 'folder-123' });

    expect(mockStepHandle.end).toHaveBeenCalledWith({ folderUID: 'folder-123' });
  });

  it('should start select_resource step when non-folder item is clicked', () => {
    loadWiring();

    // Start the journey first
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    simulateInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: 'dashboard',
      uid: 'dash-456',
    });

    expect(mockHandle.startStep).toHaveBeenCalledWith('select_resource', {
      resourceType: 'dashboard',
      resourceUID: 'dash-456',
    });

    expect(mockHandle.setAttributes).toHaveBeenCalledWith({
      resourceType: 'dashboard',
      resourceUID: 'dash-456',
    });
  });

  it('should end select_resource step and journey on dashboards_init_dashboard_completed', () => {
    loadWiring();

    // Start the journey
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    const mockStepHandle = createMockStepHandle();
    mockHandle.startStep.mockReturnValue(mockStepHandle);

    // Click a dashboard
    simulateInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: 'dashboard',
      uid: 'dash-456',
    });

    // Dashboard loads
    simulateInteraction('dashboards_init_dashboard_completed', { uid: 'dash-456' });

    expect(mockStepHandle.end).toHaveBeenCalledWith({ dashboardUid: 'dash-456' });
    expect(mockHandle.end).toHaveBeenCalledWith('success');
    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'dashboard',
        dashboardUid: 'dash-456',
      })
    );
  });

  it('should end journey with success on dashboard load even without prior item click', () => {
    loadWiring();

    // Start the journey
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    // Dashboard loads directly (e.g. user navigated via URL)
    simulateInteraction('dashboards_init_dashboard_completed', { uid: 'dash-789' });

    expect(mockHandle.end).toHaveBeenCalledWith('success');
    expect(mockHandle.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'dashboard',
        dashboardUid: 'dash-789',
      })
    );
  });

  it('should not start select_resource step for folder clicks (only navigate_folder)', () => {
    loadWiring();

    // Start the journey
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    simulateInteraction('grafana_browse_dashboards_page_click_list_item', {
      itemKind: 'folder',
      uid: 'folder-abc',
    });

    // startStep should only be called for navigate_folder, not select_resource
    const startStepCalls = mockHandle.startStep.mock.calls;
    for (const call of startStepCalls) {
      expect(call[0]).not.toBe('select_resource');
    }
  });

  it('should close a pending navigate_folder step when a second list item is clicked before the page navigates', () => {
    loadWiring();
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    const firstStep = createMockStepHandle();
    const secondStep = createMockStepHandle();
    mockHandle.startStep.mockReturnValueOnce(firstStep).mockReturnValueOnce(secondStep);

    simulateInteraction('grafana_browse_dashboards_page_click_list_item', { itemKind: 'folder', uid: 'folder-A' });
    // User clicks another item before the page_view fires for folder-A
    simulateInteraction('grafana_browse_dashboards_page_click_list_item', { itemKind: 'folder', uid: 'folder-B' });

    // The first step must have been ended explicitly with outcome=superseded,
    // not orphaned for the framework backstop to clean up.
    expect(firstStep.end).toHaveBeenCalledWith({ outcome: 'superseded' });
    expect(secondStep.end).not.toHaveBeenCalled();
  });

  it('should record a folder_created event when grafana_manage_dashboards_folder_created fires', () => {
    loadWiring();
    simulateInteraction('grafana_browse_dashboards_page_view', { folderUID: '' });

    simulateInteraction('grafana_manage_dashboards_folder_created', {
      is_subfolder: true,
      folder_depth: 2,
    });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('folder_created', {
      isSubfolder: 'true',
      folderDepth: '2',
    });
    expect(mockHandle.end).not.toHaveBeenCalled();
  });
});
