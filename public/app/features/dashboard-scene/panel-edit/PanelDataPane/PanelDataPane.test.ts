import { locationService } from '@grafana/runtime';
import { DashboardDataDTO } from 'app/types/dashboard';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../../utils/utils';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataPane } from './PanelDataPane';
import { TabId } from './types';

function setupScene(panelId: string) {
  const scene = transformSaveModelToScene({
    dashboard: testDashboard as unknown as DashboardDataDTO,
    meta: {},
  });
  const panel = findVizPanelByKey(scene, panelId)!;

  return { scene, panel };
}

describe('PanelDataPane URL sync', () => {
  afterEach(() => {
    locationService.push('/');
  });

  it('should sync tab from URL when updateFromUrl is called with transformations', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Simulate URL sync with tab=transformations
    dataPane.updateFromUrl({ tab: 'transformations' });

    // Verify that the transformations tab is selected
    expect(dataPane.state.tab).toBe(TabId.Transformations);
  });

  it('should sync tab from URL when updateFromUrl is called with queries', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Start with transformations tab
    dataPane.setState({ tab: TabId.Transformations });

    // Simulate URL sync with tab=queries
    dataPane.updateFromUrl({ tab: 'queries' });

    // Verify that the queries tab is selected
    expect(dataPane.state.tab).toBe(TabId.Queries);
  });

  it('should sync tab from URL when updateFromUrl is called with alerting', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Simulate URL sync with tab=alerting
    dataPane.updateFromUrl({ tab: 'alert' });

    // Verify that the alerting tab is selected
    expect(dataPane.state.tab).toBe(TabId.Alert);
  });

  it('should ignore updateFromUrl when tab value is missing', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Set initial state
    const initialTab = dataPane.state.tab;

    // Simulate URL sync with no tab value
    dataPane.updateFromUrl({});

    // Should remain unchanged
    expect(dataPane.state.tab).toBe(initialTab);
  });

  it('should ignore updateFromUrl when tab value is not a string', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Set initial state
    const initialTab = dataPane.state.tab;

    // Simulate URL sync with non-string tab value
    dataPane.updateFromUrl({ tab: ['transformations'] });

    // Should remain unchanged
    expect(dataPane.state.tab).toBe(initialTab);
  });

  it('should return correct URL state from getUrlState', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Set transformations tab
    dataPane.setState({ tab: TabId.Transformations });

    // Get URL state
    const urlState = dataPane.getUrlState();

    // Should return the current tab
    expect(urlState).toEqual({ tab: TabId.Transformations });
  });

  it('should have correct URL sync keys configured', () => {
    const { panel } = setupScene('panel-1');

    // Create a PanelDataPane directly
    const dataPane = PanelDataPane.createFor(panel);

    // Check that urlSync is configured correctly
    expect(dataPane.urlSync).toBeDefined();
    expect(dataPane.urlSync!.getKeys()).toEqual(['tab']);
  });

  it('should automatically call updateFromUrl when PanelDataPane is dynamically added with tab in URL', () => {
    // Mock console.error to suppress expected datasource error
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Set URL with tab=transformations BEFORE creating PanelDataPane
    locationService.partial({ tab: 'transformations' });

    const { panel } = setupScene('panel-1');
    const dataPane = PanelDataPane.createFor(panel);
    dataPane.activate();

    // The activation handler should have read the URL and set the correct tab
    expect(dataPane.state.tab).toBe(TabId.Transformations);
  });
});
