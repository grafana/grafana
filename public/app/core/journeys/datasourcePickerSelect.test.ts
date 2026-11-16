import { waitFor } from '@testing-library/react';

import { type JourneyHandle, type JourneyTracker, locationService, type StepHandle } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/journey/JourneyRegistryImpl';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockStepHandle,
  createMockTracker,
  setupJourneyTest,
} from './__test-utils__/journeyTestHarness';
import { getPickerSurface } from './datasourcePickerSelect';

const mockGetDataSourceInstanceList = jest.fn();
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getDataSourceInstanceList: (...args: unknown[]) => mockGetDataSourceInstanceList(...args),
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

describe('datasourcePickerSelect journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let mockStep: jest.Mocked<StepHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockGetDataSourceInstanceList.mockReset().mockResolvedValue([]);
    mockHandle = createMockHandle('datasource_picker_select');
    mockStep = createMockStepHandle();
    mockHandle.startStep.mockReturnValue(mockStep);
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
    locationService.push('/explore');
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./datasourcePickerSelect');
    });
  }

  function openPicker() {
    simulateInteraction('dashboards_dspicker_opened', { cycle_id: 'c1' });
  }

  it('starts the journey with the surface when the picker opens', () => {
    loadWiring();

    openPicker();

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'datasource_picker_select',
      expect.objectContaining({ attributes: { surface: 'explore' } })
    );
  });

  it('does not start on other picker interactions', () => {
    loadWiring();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'open_dspicker', total_configured: 10000 });
    simulateInteraction('dashboards_dspicker_clicked', { item: 'search', query: 'prom' });
    simulateInteraction('dashboards_dspicker_clicked', { item: 'select_ds', ds_type: 'prometheus' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  // A journey left active (e.g. a picker that never reported an end) must not swallow later opens;
  // the registry's cancelOnRestart cancels the old instance.
  it('starts a fresh journey on every open, even while one is active', () => {
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);
    loadWiring();

    openPicker();
    openPicker();

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(2);
  });

  it('measures list_render from open until the list has rendered', () => {
    loadWiring();
    openPicker();

    expect(mockHandle.startStep).toHaveBeenCalledWith('list_render');
    expect(mockStep.end).not.toHaveBeenCalled();

    simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 9876 });

    expect(mockStep.end).toHaveBeenCalledWith({ totalListed: '9876' });
  });

  it('records every configured data source once the list has rendered', async () => {
    mockGetDataSourceInstanceList.mockResolvedValue(new Array(10000).fill({}));
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 20 });

    expect(mockGetDataSourceInstanceList).toHaveBeenCalledWith({ all: true });
    await waitFor(() => expect(mockHandle.setAttributes).toHaveBeenCalledWith({ totalConfigured: '10000' }));
  });

  it('counts configured data sources once per session, not on every open', async () => {
    mockGetDataSourceInstanceList.mockResolvedValue(new Array(10000).fill({}));
    loadWiring();

    for (const cycleId of ['c1', 'c2']) {
      simulateInteraction('dashboards_dspicker_opened', { cycle_id: cycleId });
      simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 20, cycle_id: cycleId });
    }

    await waitFor(() => expect(mockHandle.setAttributes).toHaveBeenCalledTimes(2));
    expect(mockGetDataSourceInstanceList).toHaveBeenCalledTimes(1);
  });

  it('adds the configured count to the end attributes once it is known', async () => {
    mockGetDataSourceInstanceList.mockResolvedValue(new Array(10000).fill({}));
    loadWiring();
    openPicker();
    simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 20, cycle_id: 'c1' });
    await waitFor(() => expect(mockHandle.setAttributes).toHaveBeenCalled());

    openPicker();
    simulateInteraction('dashboards_dspicker_dismissed', { cycle_id: 'c1' });

    expect(mockHandle.end).toHaveBeenCalledWith('discarded', { totalConfigured: '10000' });
  });

  it('ends with success and changed=false when the current data source is picked again in the modal', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'open_advanced_ds_picker' });
    simulateInteraction('dashboards_dspicker_current_reselected', { ds_type: 'loki', cycle_id: 'c1' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', { dsType: 'loki', changed: 'false', selectedIn: 'modal' });
  });

  it('ignores events from another open of a picker', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 5, cycle_id: 'other' });
    simulateInteraction('dashboards_dspicker_dismissed', { cycle_id: 'other' });
    simulateInteraction('dashboards_dspicker_cleared', { cycle_id: 'other' });
    simulateInteraction('dashboards_dspicker_current_reselected', { cycle_id: 'other' });

    expect(mockStep.end).not.toHaveBeenCalled();
    expect(mockHandle.end).not.toHaveBeenCalled();

    simulateInteraction('dashboards_dspicker_dismissed', { cycle_id: 'c1' });

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  it('records search events', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'search', query: 'prom' });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('search');
  });

  it('ends with success when a data source is selected in the dropdown', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'select_ds', ds_type: 'prometheus' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', {
      dsType: 'prometheus',
      changed: 'true',
      selectedIn: 'dropdown',
    });
  });

  it('ends with success and changed=false when the current data source is picked again', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_current_reselected', { ds_type: 'loki' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', {
      dsType: 'loki',
      changed: 'false',
      selectedIn: 'dropdown',
    });
  });

  it('attributes the selection to the modal after the advanced picker is opened', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'open_advanced_ds_picker' });
    simulateInteraction('dashboards_dspicker_clicked', { item: 'select_ds', ds_type: 'tempo' });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('open_advanced');
    expect(mockHandle.end).toHaveBeenCalledWith('success', { dsType: 'tempo', changed: 'true', selectedIn: 'modal' });
  });

  it('ends as discarded when the dropdown is dismissed', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_dismissed');

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  it('ends as abandoned when the picker unmounts while open', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_dismissed', { reason: 'unmount' });

    expect(mockHandle.end).toHaveBeenCalledWith('abandoned', { reason: 'unmount' });
  });

  it('ends as abandoned when the route changes', () => {
    loadWiring();
    openPicker();

    locationService.push('/d/abc/my-dashboard');

    expect(mockHandle.end).toHaveBeenCalledWith('abandoned', { abandonedAt: '/d/abc/my-dashboard' });
  });

  it('does not end when only query params change', () => {
    loadWiring();
    openPicker();

    locationService.partial({ left: '{}' });

    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('ends with success and cleared=true when the data source is cleared', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_cleared');

    expect(mockHandle.end).toHaveBeenCalledWith('success', {
      changed: 'true',
      cleared: 'true',
      selectedIn: 'dropdown',
    });
  });

  it('uses the surface reported by the picker over the URL', () => {
    locationService.push('/d/abc/my-dashboard');
    loadWiring();

    simulateInteraction('dashboards_dspicker_opened', { surface: 'variable_editor' });

    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'datasource_picker_select',
      expect.objectContaining({ attributes: { surface: 'variable_editor' } })
    );
  });

  it('ends as discarded when the advanced modal is dismissed', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspickermodal_clicked', { item: 'dismiss', src: 'ds_picker' });

    expect(mockHandle.end).toHaveBeenCalledWith('discarded');
  });

  it('ends as abandoned when the user leaves to configure a new data source', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspickermodal_clicked', { item: 'config_new_ds', src: 'ds_picker' });

    expect(mockHandle.end).toHaveBeenCalledWith('abandoned', { reason: 'config_new_ds' });
  });

  it.each([
    ['dashboards_dspicker_clicked', 'the dropdown'],
    ['dashboards_dspickermodal_clicked', 'the modal'],
  ])('records an event without ending when the empty-state link is used in %s (%s)', (event) => {
    loadWiring();
    openPicker();

    simulateInteraction(event, { item: 'config_new_ds_empty_state' });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('config_new_ds');
    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('records search events in the advanced modal', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspickermodal_clicked', { item: 'search', src: 'ds_picker' });

    expect(mockHandle.recordEvent).toHaveBeenCalledWith('search');
  });

  it('ignores unrelated picker interactions', () => {
    loadWiring();
    openPicker();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'toggle_favorite' });

    expect(mockHandle.end).not.toHaveBeenCalled();
    expect(mockHandle.recordEvent).not.toHaveBeenCalled();
  });
});

describe('getPickerSurface', () => {
  it.each([
    ['/explore', '?left=%7B%7D', 'explore'],
    ['/alerting/new', '', 'alerting'],
    ['/d/abc/my-dashboard', '?editPanel=2', 'panel_edit'],
    ['/d/abc/my-dashboard', '?editview=variables&editIndex=0', 'variable_editor'],
    ['/d/abc/my-dashboard', '?editview=annotations', 'annotation_editor'],
    ['/d/abc/my-dashboard', '', 'dashboard'],
    ['/dashboard/new', '', 'dashboard'],
    ['/dashboard/import', '', 'import'],
    ['/connections/datasources', '', 'other'],
  ])('maps %s%s to %s', (pathname, search, expected) => {
    expect(getPickerSurface(pathname, search)).toBe(expected);
  });
});
