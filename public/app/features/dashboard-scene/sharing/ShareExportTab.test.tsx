import { config } from '@grafana/runtime';
import { SceneTimeRange } from '@grafana/scenes';
import {
  Spec as DashboardV2Spec,
  defaultQueryGroupKind,
  defaultVizConfigSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import * as dashboardApiModule from 'app/features/dashboard/api/dashboard_api';
import { ExportFormat, DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { DashboardDataDTO } from 'app/types/dashboard';

import { DashboardScene } from '../scene/DashboardScene';
import * as exporters from '../scene/export/exporters';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { ShareExportTab } from './ShareExportTab';

jest.mock('app/features/dashboard/api/dashboard_api');

const mockV1Spec: DashboardDataDTO = {
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

const mockV2Spec: DashboardV2Spec = {
  title: 'Test Dashboard V2',
  description: 'Test V2 dashboard',
  annotations: [],
  cursorSync: 'Off',
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

const mockV2SpecWithLibraryPanels: DashboardV2Spec = {
  ...mockV2Spec,
  title: 'Test Dashboard V2',
  elements: {
    'element-1': {
      kind: 'Panel',
      spec: {
        id: 1,
        title: 'Regular Panel',
        description: '',
        links: [],
        data: defaultQueryGroupKind(),
        vizConfig: {
          kind: 'VizConfig',
          group: '',
          version: '1.0.0',
          spec: defaultVizConfigSpec(),
        },
      },
    },
    'element-2': {
      kind: 'LibraryPanel',
      spec: {
        id: 2,
        title: 'My Library Panel',
        libraryPanel: { uid: 'lib-panel-uid', name: 'My Library Panel' },
      },
    },
  },
};

const mockV1WithLibraryPanels: DashboardDataDTO = {
  ...mockV1Spec,
  panels: [
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
  ],
};

const mockV2ResourceResponse: DashboardWithAccessInfo<DashboardV2Spec> = {
  apiVersion: 'dashboard.grafana.app/v2beta1',
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'test-uid-v2',
    resourceVersion: '1',
    creationTimestamp: '2025-01-01T00:00:00Z',
    generation: 1,
  },
  spec: mockV2Spec,
  access: {},
  status: {},
};

function mockGetDashboardAPI(v1Spec: DashboardDataDTO, v2Response: DashboardWithAccessInfo<DashboardV2Spec>) {
  const getDashboardAPIMock = dashboardApiModule.getDashboardAPI as jest.Mock;
  getDashboardAPIMock.mockImplementation((version?: string) => {
    if (version === 'v1') {
      return {
        getDashboardDTO: jest.fn().mockResolvedValue({
          dashboard: v1Spec,
          meta: { uid: v1Spec.uid, isNew: false, isFolder: false },
        }),
      };
    }
    if (version === 'v2') {
      return {
        getDashboardDTO: jest.fn().mockResolvedValue(v2Response),
      };
    }
    throw new Error(`Unexpected version: ${version}`);
  });
}

describe('ShareExportTab', () => {
  let makeExportableV1Spy: jest.SpyInstance;
  let makeExportableV2Spy: jest.SpyInstance;

  beforeEach(() => {
    config.featureToggles.kubernetesDashboards = true;
    config.featureToggles.dashboardNewLayouts = false;

    makeExportableV1Spy = jest.spyOn(exporters, 'makeExportableV1').mockImplementation(async (dashboard) => dashboard);
    makeExportableV2Spy = jest.spyOn(exporters, 'makeExportableV2').mockImplementation(async (spec) => spec);

    mockGetDashboardAPI(mockV1Spec, mockV2ResourceResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('V2Resource export mode', () => {
    beforeEach(() => {
      config.featureToggles.dashboardNewLayouts = true;
    });

    it('should default to V2Resource when dashboardNewLayouts is enabled', async () => {
      const tab = buildV2DashboardScenario();

      expect(tab.state.exportFormat).toBe(ExportFormat.V2Resource);

      const result = await tab.getExportableDashboardJson();

      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'Dashboard',
      });
      expect(result.json).not.toHaveProperty('status');
      expect(result.json).not.toHaveProperty('access');
    });

    it('should fetch Classic when user switches to Classic mode', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.Classic });

      const result = await tab.getExportableDashboardJson();

      expect(dashboardApiModule.getDashboardAPI).toHaveBeenCalledWith('v1');
      expect(result.json).toMatchObject({ title: 'Test Dashboard V1', uid: 'test-uid-v1' });
      expect(result.initialSaveModelVersion).toBe('v2');
    });

    it('should strip metadata when sharing externally', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.V2Resource, isSharingExternally: true });

      const result = await tab.getExportableDashboardJson();

      expect(makeExportableV2Spy).toHaveBeenCalled();
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'Dashboard',
      });
      expect(result.json).not.toHaveProperty('status');
      expect(result.json).not.toHaveProperty('access');
      if ('metadata' in result.json) {
        expect(result.json.metadata).not.toHaveProperty('resourceVersion');
        expect(result.json.metadata).not.toHaveProperty('namespace');
      }
    });

    it('should fetch V2 resource for V1 dashboard (server converts)', async () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.V2Resource });

      const result = await tab.getExportableDashboardJson();

      expect(dashboardApiModule.getDashboardAPI).toHaveBeenCalledWith('v2');
      expect(result.json).toMatchObject({
        apiVersion: 'dashboard.grafana.app/v2beta1',
        kind: 'Dashboard',
      });
      expect(result.json).not.toHaveProperty('status');
      expect(result.json).not.toHaveProperty('access');
    });

    it('should detect library panels in V2 response', async () => {
      mockGetDashboardAPI(mockV1Spec, {
        ...mockV2ResourceResponse,
        spec: mockV2SpecWithLibraryPanels,
      });

      const tab = buildV2DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.V2Resource });

      const result = await tab.getExportableDashboardJson();
      expect(result.hasLibraryPanels).toBe(true);
    });

    it('should report no library panels when V2 dashboard has none', async () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.V2Resource });

      const result = await tab.getExportableDashboardJson();
      expect(result.hasLibraryPanels).toBe(false);
    });

    it('should handle API errors gracefully', async () => {
      const getDashboardAPIMock = dashboardApiModule.getDashboardAPI as jest.Mock;
      getDashboardAPIMock.mockImplementation(() => ({
        getDashboardDTO: jest.fn().mockRejectedValue(new Error('API down')),
      }));

      const tab = buildV2DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.V2Resource });

      const result = await tab.getExportableDashboardJson();
      expect(result.json).toHaveProperty('error');
    });
  });

  describe('Classic export mode', () => {
    it('should default to Classic when dashboardNewLayouts is disabled', () => {
      const tab = buildV1DashboardScenario();
      expect(tab.state.exportFormat).toBe(ExportFormat.Classic);
    });

    it('should export V1 dashboard as plain JSON via API', async () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.Classic });

      const result = await tab.getExportableDashboardJson();

      expect(dashboardApiModule.getDashboardAPI).toHaveBeenCalledWith('v1');
      expect(result.json).toMatchObject({ title: 'Test Dashboard V1', uid: 'test-uid-v1' });
      expect(result.json).not.toHaveProperty('apiVersion');
      expect(result.json).not.toHaveProperty('kind');
      expect(result.initialSaveModelVersion).toBe('v1');
    });

    it('should fetch V1 for V2 dashboard (server converts)', async () => {
      const tab = buildV2DashboardScenario();
      tab.onExportFormatChange(ExportFormat.Classic);

      const result = await tab.getExportableDashboardJson();

      expect(dashboardApiModule.getDashboardAPI).toHaveBeenCalledWith('v1');
      expect(result.json).not.toHaveProperty('apiVersion');
      expect(result.json).not.toHaveProperty('kind');
      expect(result.json).not.toHaveProperty('elements');
    });

    it('should apply makeExportableV1 when sharing externally', async () => {
      const tab = buildV1DashboardScenario();
      tab.onExportFormatChange(ExportFormat.Classic);
      tab.setState({ isSharingExternally: true });

      const result = await tab.getExportableDashboardJson();

      expect(makeExportableV1Spy).toHaveBeenCalled();
      expect(result.json).not.toHaveProperty('apiVersion');
    });

    it('should detect library panels in classic V1 response', async () => {
      mockGetDashboardAPI(mockV1WithLibraryPanels, mockV2ResourceResponse);

      const tab = buildV1DashboardScenario();
      tab.setState({ exportFormat: ExportFormat.Classic });

      const result = await tab.getExportableDashboardJson();
      expect(result.hasLibraryPanels).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const getDashboardAPIMock = dashboardApiModule.getDashboardAPI as jest.Mock;
      getDashboardAPIMock.mockImplementation(() => ({
        getDashboardDTO: jest.fn().mockRejectedValue(new Error('Conversion failed')),
      }));

      const tab = buildV2DashboardScenario();
      tab.onExportFormatChange(ExportFormat.Classic);

      const result = await tab.getExportableDashboardJson();
      expect(result.json).toHaveProperty('error');
    });
  });

  describe('Export mode state management', () => {
    it('should disable YAML viewing when switching to Classic mode', () => {
      const tab = buildV1DashboardScenario();
      tab.setState({ isViewingYAML: true });
      expect(tab.state.isViewingYAML).toBe(true);

      tab.onExportFormatChange(ExportFormat.Classic);
      expect(tab.state.isViewingYAML).toBe(false);
    });

    it('should preserve YAML viewing when switching to V2Resource', () => {
      const tab = buildV2DashboardScenario();
      tab.setState({ isViewingYAML: true });
      expect(tab.state.isViewingYAML).toBe(true);

      tab.onExportFormatChange(ExportFormat.V2Resource);
      expect(tab.state.isViewingYAML).toBe(true);
    });
  });

  describe('Legacy mode (kubernetesDashboards off)', () => {
    beforeEach(() => {
      config.featureToggles.kubernetesDashboards = false;
      (dashboardApiModule.getDashboardAPI as jest.Mock).mockClear();
    });

    it('should use scene serialization instead of API', async () => {
      const tab = buildV1DashboardScenario();

      const result = await tab.getExportableDashboardJson();

      expect(dashboardApiModule.getDashboardAPI).not.toHaveBeenCalled();
      expect(result.json).toMatchObject({ title: 'Test Dashboard V1', uid: 'test-uid-v1' });
      expect(result.initialSaveModelVersion).toBe('v1');
    });
  });

  function createDashboardScenario(version: 'v1' | 'v2'): ShareExportTab {
    const currentDashboard = version === 'v1' ? mockV1Spec : mockV2Spec;
    const initialSaveModel = version === 'v1' ? mockV1Spec : mockV2Spec;

    const tab = new ShareExportTab({});
    const scene = new DashboardScene({
      title: `Test Dashboard ${version.toUpperCase()}`,
      uid: `test-uid-${version}`,
      meta: { canEdit: true },
      $timeRange: new SceneTimeRange({}),
      body: DefaultGridLayoutManager.fromVizPanels([]),
      overlay: tab,
    });

    scene.serializer.getSaveModel = jest.fn(() => currentDashboard);
    scene.serializer.makeExportableExternally = jest.fn(() =>
      Promise.resolve(currentDashboard)
    ) as DashboardScene['serializer']['makeExportableExternally'];
    scene.getInitialSaveModel = jest.fn(() => initialSaveModel);

    return tab;
  }

  const buildV1DashboardScenario = () => createDashboardScenario('v1');
  const buildV2DashboardScenario = () => createDashboardScenario('v2');
});
