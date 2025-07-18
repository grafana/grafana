import { config } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import {
  Spec as DashboardV2Spec,
  defaultQueryGroupKind,
  defaultVizConfigSpec,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import * as ResponseTransformers from 'app/features/dashboard/api/ResponseTransformers';
import { DashboardJson } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import * as exporters from '../scene/export/exporters';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import * as sceneToV1 from '../serialization/transformSceneToSaveModel';
import * as sceneToV2 from '../serialization/transformSceneToSaveModelSchemaV2';

import { ExportMode } from './ExportButton/ResourceExport';
import { ShareExportTab } from './ShareExportTab';

describe('ShareExportTab', () => {
  // Spies to track function calls
  let transformV2ToV1Spy: jest.SpyInstance;
  let makeExportableV1Spy: jest.SpyInstance;
  let transformSceneToV1Spy: jest.SpyInstance;
  let transformSceneToV2Spy: jest.SpyInstance;

  beforeEach(() => {
    config.featureToggles.kubernetesDashboards = true;
    config.featureToggles.dashboardNewLayouts = false;

    // Set up spies on the functions we want to track
    transformV2ToV1Spy = jest.spyOn(ResponseTransformers, 'transformDashboardV2SpecToV1').mockReturnValue({
      title: 'Transformed V1',
      uid: 'transformed-uid',
      version: 1,
      panels: [],
      time: { from: 'now-6h', to: 'now' },
      timepicker: {},
      timezone: '',
      weekStart: '',
      fiscalYearStartMonth: 0,
      refresh: '',
      schemaVersion: 30,
      tags: [],
      templating: { list: [] },
    } as DashboardDataDTO);

    makeExportableV1Spy = jest.spyOn(exporters, 'makeExportableV1').mockImplementation(async (dashboard) => dashboard);

    transformSceneToV1Spy = jest.spyOn(sceneToV1, 'transformSceneToSaveModel').mockReturnValue({
      title: 'Scene V1',
      uid: 'scene-v1-uid',
      version: 1,
      panels: [],
      time: { from: 'now-6h', to: 'now' },
      timepicker: {},
      timezone: '',
      weekStart: '',
      fiscalYearStartMonth: 0,
      refresh: '',
      schemaVersion: 30,
      tags: [],
      templating: { list: [] },
    } as Dashboard);

    transformSceneToV2Spy = jest.spyOn(sceneToV2, 'transformSceneToSaveModelSchemaV2').mockReturnValue({
      title: 'Scene V2',
      annotations: [],
      cursorSync: 'Off',
      description: '',
      editable: true,
      elements: {},
      layout: { kind: 'GridLayout', spec: { items: [] } },
      links: [],
      liveNow: false,
      preload: false,
      tags: [],
      timeSettings: {
        from: 'now-6h',
        to: 'now',
        autoRefresh: '',
        autoRefreshIntervals: [],
        hideTimepicker: false,
        timezone: '',
        weekStart: 'saturday',
        fiscalYearStartMonth: 0,
      },
      variables: [],
    } as DashboardV2Spec);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('V1Resource export mode', () => {
    // If V1 dashboard → V1 Resource should export with V1 apiVersion
    it('should export V1 dashboard as V1 resource with correct apiVersion', async () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ exportMode: ExportMode.V1Resource });

      const result = await tab.getExportableDashboardJson();

      // Should use V1 API version
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        status: {},
      });

      // Should call transformSceneToV1 (not transform V2→V1)
      expect(transformSceneToV1Spy).toHaveBeenCalled();
      expect(transformV2ToV1Spy).not.toHaveBeenCalled();

      // Should report correct initial version
      expect(result.initialSaveModelVersion).toBe('v1');
    });

    // If V2 dashboard → V1 Resource should auto-transform with V1 apiVersion
    it('should auto-transform V2 dashboard to V1 resource with correct apiVersion', async () => {
      const tab = buildV2DashboardScenario();
      // user selects V1Resource even though is V2 dashboard
      tab.setState({ exportMode: ExportMode.V1Resource });

      const result = await tab.getExportableDashboardJson();

      // Should use V1 API version (not V2!)
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        status: {},
      });

      // Should auto-transform V2→V1
      expect(transformSceneToV2Spy).toHaveBeenCalled(); // Get V2 spec first
      expect(transformV2ToV1Spy).toHaveBeenCalled(); // Then transform to V1

      // Should report correct initial version
      expect(result.initialSaveModelVersion).toBe('v2');
    });

    // If V2 dashboard → V1 Resource with external sharing should transform and apply external sharing
    it('should handle external sharing when transforming V2 to V1', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({
        exportMode: ExportMode.V1Resource,
        isSharingExternally: true,
      });

      const result = await tab.getExportableDashboardJson();

      // Should use V1 API version
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v1beta1',
        kind: 'Dashboard',
        status: {},
      });

      // Should auto-transform V2→V1
      expect(transformSceneToV2Spy).toHaveBeenCalled();
      expect(transformV2ToV1Spy).toHaveBeenCalled();

      // Should call makeExportableV1 for external sharing
      expect(makeExportableV1Spy).toHaveBeenCalled();

      // Should report correct initial version
      expect(result.initialSaveModelVersion).toBe('v2');
    });
  });

  describe('V2Resource export mode', () => {
    // If V2 dashboard → V2 Resource should export with V2 apiVersion
    it('should export V2 dashboard as V2 resource with correct apiVersion', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should use V2 API version
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v2alpha1',
        kind: 'Dashboard',
        status: {},
      });

      // Should not call V2→V1 transformation since source is already V2
      expect(transformV2ToV1Spy).not.toHaveBeenCalled();

      // Should report correct initial version
      expect(result.initialSaveModelVersion).toBe('v2');
    });

    // If V1 dashboard → V2 Resource should detect library panels correctly
    it('should detect library panels in V1 dashboard when exporting as V2 resource', async () => {
      const tab = buildV1DashboardWithLibraryPanels();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should detect library panels from V1 dashboard
      expect(result.hasLibraryPanels).toBe(true);
      expect(result.initialSaveModelVersion).toBe('v1');
    });

    // If V1 dashboard with dashboardNewLayouts disabled → V2 Resource should detect library panels correctly
    it('should detect library panels in V1 dashboard when user selects V2Resource export mode', async () => {
      const tab = buildV1DashboardWithLibraryPanels();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should detect library panels from V1 dashboard (first branch of the logic)
      expect(result.hasLibraryPanels).toBe(true);
      expect(result.initialSaveModelVersion).toBe('v1');
    });

    // If V1 dashboard without library panels → V2 Resource should return false
    it('should return false for hasLibraryPanels when V1 dashboard has no library panels', async () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should not detect library panels
      expect(result.hasLibraryPanels).toBe(false);
      expect(result.initialSaveModelVersion).toBe('v1');
    });
  });

  describe('V2Resource export mode with dashboardNewLayouts disabled', () => {
    beforeEach(() => {
      config.featureToggles.dashboardNewLayouts = false;
    });

    afterEach(() => {
      config.featureToggles.dashboardNewLayouts = true;
    });

    // If V2 dashboard → V2 Resource should detect library panels correctly
    it('should detect library panels in V2 dashboard when exporting as V2 resource', async () => {
      const tab = buildV2DashboardWithLibraryPanels();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should detect library panels from V2 dashboard elements (second branch of the logic)
      expect(result.hasLibraryPanels).toBe(true);
      expect(result.initialSaveModelVersion).toBe('v2');
    });

    // Test the second branch: V2 dashboard with V1 initial save model
    it('should detect library panels in V2 dashboard with V1 initial save model', async () => {
      const tab = buildV2DashboardWithV1InitialSaveModel();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should detect library panels from V2 dashboard elements (second branch of the logic)
      expect(result.hasLibraryPanels).toBe(true);
      expect(result.initialSaveModelVersion).toBe('v1');
    });

    // If V2 dashboard without library panels → V2 Resource should return false
    it('should return false for hasLibraryPanels when V2 dashboard has no library panels', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ exportMode: ExportMode.V2Resource });

      const result = await tab.getExportableDashboardJson();

      // Should not detect library panels
      expect(result.hasLibraryPanels).toBe(false);
      expect(result.initialSaveModelVersion).toBe('v2');
    });
  });

  describe('Classic export mode', () => {
    // If V1 dashboard → Classic should export plain dashboard JSON
    it('should export V1 dashboard in classic format', async () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ exportMode: ExportMode.Classic });

      const result = await tab.getExportableDashboardJson();

      // Should return plain dashboard JSON (not wrapped in resource)
      expect(result.json).toMatchObject({
        title: 'Test Dashboard V1',
        uid: 'test-uid-v1',
        panels: expect.any(Array),
      });

      // Should NOT have resource wrapper properties
      expect(result.json).not.toHaveProperty('apiVersion');
      expect(result.json).not.toHaveProperty('kind');
      expect(result.json).not.toHaveProperty('status');

      // Should report correct initial version
      expect(result.initialSaveModelVersion).toBe('v1');
    });
  });

  describe('Export mode state management', () => {
    // If switching to Classic mode should disable YAML viewing
    it('should disable YAML viewing when switching to Classic mode', async () => {
      const tab = buildV1DashboardScenario();

      // Start with YAML viewing enabled
      tab.setState({ isViewingYAML: true });
      expect(tab.state.isViewingYAML).toBe(true);

      // Switch to Classic mode
      tab.onExportModeChange(ExportMode.Classic);

      // Should disable YAML viewing
      expect(tab.state.isViewingYAML).toBe(false);
    });

    // If switching to resource modes should preserve YAML viewing
    it('should preserve YAML viewing when switching to resource modes', async () => {
      const tab = buildV2DashboardScenario();

      // Start with YAML viewing enabled
      tab.setState({ isViewingYAML: true });
      expect(tab.state.isViewingYAML).toBe(true);

      // Switch to V1Resource mode
      tab.onExportModeChange(ExportMode.V1Resource);
      expect(tab.state.isViewingYAML).toBe(true); // Should preserve

      // Switch to V2Resource mode
      tab.onExportModeChange(ExportMode.V2Resource);
      expect(tab.state.isViewingYAML).toBe(true); // Should preserve
    });
  });

  // Helper factory to create test scenarios
  function createDashboardScenario(options: {
    version: 'v1' | 'v2';
    hasLibraryPanels?: boolean;
    initialSaveModelVersion?: 'v1' | 'v2';
  }): ShareExportTab {
    const { version, hasLibraryPanels = false, initialSaveModelVersion = version } = options;

    // Create V1 dashboard
    const mockV1Dashboard: DashboardDataDTO = {
      title: `Test Dashboard V1`,
      uid: 'test-uid-v1',
      version: 1,
      panels: hasLibraryPanels
        ? [
            {
              id: 1,
              type: 'stat',
              title: 'Regular Panel',
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
              targets: [],
              options: {},
              fieldConfig: { defaults: {}, overrides: [] },
            },
            {
              id: 2,
              type: 'library-panel-ref',
              libraryPanel: { uid: 'lib-panel-uid', name: 'My Library Panel' },
            },
          ]
        : [],
      time: { from: 'now-6h', to: 'now' },
      timepicker: {},
      timezone: '',
      weekStart: '',
      fiscalYearStartMonth: 0,
      refresh: '',
      schemaVersion: 30,
      tags: [],
      templating: { list: [] },
    };

    // Create V2 dashboard
    const mockV2Dashboard: DashboardV2Spec = {
      title: `Test Dashboard V2`,
      annotations: [],
      cursorSync: 'Off',
      description: 'Test V2 dashboard',
      editable: true,
      elements: hasLibraryPanels
        ? {
            'element-1': {
              kind: 'Panel',
              spec: {
                id: 1,
                title: 'Regular Panel',
                description: '',
                links: [],
                data: defaultQueryGroupKind(),
                vizConfig: {
                  kind: 'stat',
                  spec: defaultVizConfigSpec(),
                },
              },
            },
            'element-2': {
              kind: 'LibraryPanel',
              spec: {
                id: 2,
                title: 'My Library Panel',
                libraryPanel: {
                  uid: 'lib-panel-uid',
                  name: 'My Library Panel',
                },
              },
            },
          }
        : {},
      layout: { kind: 'GridLayout', spec: { items: [] } },
      links: [],
      liveNow: false,
      preload: false,
      tags: [],
      timeSettings: {
        from: 'now-6h',
        to: 'now',
        autoRefresh: '',
        autoRefreshIntervals: [],
        hideTimepicker: false,
        timezone: '',
        weekStart: 'saturday',
        fiscalYearStartMonth: 0,
      },
      variables: [],
    };

    const tab = new ShareExportTab({});
    const scene = new DashboardScene({
      title: `Test Dashboard ${version.toUpperCase()}`,
      uid: `test-uid-${version}`,
      meta: { canEdit: true },
      $timeRange: new SceneTimeRange({}),
      body: DefaultGridLayoutManager.fromVizPanels([]),
      overlay: tab,
    });

    // Set up the scene based on current version
    const currentDashboard = version === 'v1' ? mockV1Dashboard : mockV2Dashboard;
    const initialSaveModel = initialSaveModelVersion === 'v1' ? mockV1Dashboard : mockV2Dashboard;
    const apiVersion = version === 'v1' ? 'dashboard.grafana.app/v1beta1' : 'dashboard.grafana.app/v2alpha1';

    scene.serializer.getSaveModel = jest.fn(() => currentDashboard);
    scene.serializer.makeExportableExternally = jest.fn(() =>
      Promise.resolve(
        version === 'v1' ? ({ ...mockV1Dashboard, panels: mockV1Dashboard.panels } as DashboardJson) : mockV2Dashboard
      )
    );
    scene.serializer.apiVersion = apiVersion;
    scene.getInitialSaveModel = jest.fn(() => initialSaveModel);

    return tab;
  }

  // util functions for common scenarios
  const buildV1DashboardScenario = () => createDashboardScenario({ version: 'v1' });
  const buildV2DashboardScenario = () => createDashboardScenario({ version: 'v2' });
  const buildV1DashboardWithLibraryPanels = () => createDashboardScenario({ version: 'v1', hasLibraryPanels: true });
  const buildV2DashboardWithLibraryPanels = () => createDashboardScenario({ version: 'v2', hasLibraryPanels: true });
  const buildV2DashboardWithV1InitialSaveModel = () =>
    createDashboardScenario({
      version: 'v2',
      hasLibraryPanels: true,
      initialSaveModelVersion: 'v1',
    });
});
