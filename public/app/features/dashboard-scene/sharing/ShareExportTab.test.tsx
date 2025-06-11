import { config } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import { Dashboard } from '@grafana/schema/dist/esm/index.gen';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
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

  // Helper functions to create test scenarios
  function buildV1DashboardScenario(): ShareExportTab {
    const mockV1Dashboard: DashboardDataDTO = {
      title: 'Test Dashboard V1',
      uid: 'test-uid-v1',
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
    };

    const tab = new ShareExportTab({});
    const scene = new DashboardScene({
      title: 'Test Dashboard V1',
      uid: 'test-uid-v1',
      meta: { canEdit: true },
      $timeRange: new SceneTimeRange({}),
      body: DefaultGridLayoutManager.fromVizPanels([]),
      overlay: tab,
    });

    const mockExportableDashboard: DashboardJson = {
      ...mockV1Dashboard,
      panels: [],
    } as DashboardJson;
    scene.serializer.getSaveModel = jest.fn(() => mockV1Dashboard);
    scene.serializer.makeExportableExternally = jest.fn(() => Promise.resolve(mockExportableDashboard));
    scene.serializer.apiVersion = 'dashboard.grafana.app/v1beta1';
    scene.getInitialSaveModel = jest.fn(() => mockV1Dashboard);

    return tab;
  }

  function buildV2DashboardScenario(): ShareExportTab {
    const mockV2Dashboard: DashboardV2Spec = {
      title: 'Test Dashboard V2',
      annotations: [],
      cursorSync: 'Off',
      description: 'Test V2 dashboard',
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
    };

    const tab = new ShareExportTab({});
    const scene = new DashboardScene({
      title: 'Test Dashboard V2',
      uid: 'test-uid-v2',
      meta: { canEdit: true },
      $timeRange: new SceneTimeRange({}),
      body: DefaultGridLayoutManager.fromVizPanels([]),
      overlay: tab,
    });

    scene.serializer.getSaveModel = jest.fn(() => mockV2Dashboard);
    scene.serializer.makeExportableExternally = jest.fn(() => Promise.resolve(mockV2Dashboard));
    scene.serializer.apiVersion = 'dashboard.grafana.app/v2alpha1';
    scene.getInitialSaveModel = jest.fn(() => mockV2Dashboard);

    return tab;
  }
});
