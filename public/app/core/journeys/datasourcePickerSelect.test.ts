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

describe('datasourcePickerSelect journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let mockStep: jest.Mocked<StepHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
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
    simulateInteraction('dashboards_dspicker_clicked', { item: 'open_dspicker', total_configured: 10000 });
  }

  it('starts the journey with surface and data source count when the picker opens', () => {
    loadWiring();

    openPicker();

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(1);
    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'datasource_picker_select',
      expect.objectContaining({ attributes: { surface: 'explore', totalConfigured: '10000' } })
    );
  });

  it('does not start on other picker interactions', () => {
    loadWiring();

    simulateInteraction('dashboards_dspicker_clicked', { item: 'search', query: 'prom' });
    simulateInteraction('dashboards_dspicker_clicked', { item: 'select_ds', ds_type: 'prometheus' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('does not start a second journey while one is active', () => {
    mockTracker.getActiveJourney.mockReturnValue(mockHandle);
    loadWiring();

    openPicker();

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('measures list_render from open until the list has rendered', () => {
    loadWiring();
    openPicker();

    expect(mockHandle.startStep).toHaveBeenCalledWith('list_render');
    expect(mockStep.end).not.toHaveBeenCalled();

    simulateInteraction('dashboards_dspicker_list_rendered', { total_listed: 9876 });

    expect(mockStep.end).toHaveBeenCalledWith({ totalListed: '9876' });
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
    ['/connections/datasources', '', 'other'],
  ])('maps %s%s to %s', (pathname, search, expected) => {
    expect(getPickerSurface(pathname, search)).toBe(expected);
  });
});
