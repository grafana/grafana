import { cloneDeep } from 'lodash';

import { config } from '@grafana/runtime';
import {
  behaviors,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  IntervalVariable,
  QueryVariable,
  TextBoxVariable,
  sceneGraph,
  GroupByVariable,
  AdHocFiltersVariable,
  SceneDataTransformer,
} from '@grafana/scenes';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  GroupByVariableKind,
  IntervalVariableKind,
  QueryVariableKind,
  TextVariableKind,
} from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { handyTestingSchema } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/examples';
import { AnnoKeyDashboardIsNew } from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { DashboardLayoutManager } from '../scene/types';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';
import { validateVariable, validateVizPanel } from '../v2schema/test-helpers';

import { SnapshotVariable } from './custom-variables/SnapshotVariable';
import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformCursorSynctoEnum } from './transformToV2TypesUtils';

const defaultDashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
  kind: 'DashboardWithAccessInfo',
  metadata: {
    name: 'dashboard-uid',
    namespace: 'default',
    labels: {},
    resourceVersion: '123',
    creationTimestamp: 'creationTs',
    annotations: {
      'grafana.app/createdBy': 'user:createBy',
      'grafana.app/folder': 'folder-uid',
      'grafana.app/updatedBy': 'user:updatedBy',
      'grafana.app/updatedTimestamp': 'updatedTs',
    },
  },
  spec: handyTestingSchema,
  access: {
    url: '/d/abc',
    slug: 'what-a-dashboard',
  },
  apiVersion: 'v2',
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: jest.fn(),
  }),
}));

describe('transformSaveModelSchemaV2ToScene', () => {
  beforeAll(() => {
    config.featureToggles.groupByVariable = true;
  });

  afterAll(() => {
    config.featureToggles.groupByVariable = false;
  });

  it('should initialize the DashboardScene with the model state', () => {
    const scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
    const dashboardControls = scene.state.controls!;
    const dash = defaultDashboard.spec;

    expect(scene.state.uid).toEqual(defaultDashboard.metadata.name);
    expect(scene.state.title).toEqual(dash.title);
    expect(scene.state.description).toEqual(dash.description);
    expect(scene.state.editable).toEqual(dash.editable);
    expect(scene.state.preload).toEqual(false);
    expect(scene.state.version).toEqual(123);
    expect(scene.state.tags).toEqual(dash.tags);

    const liveNow = scene.state.$behaviors?.find((b) => b instanceof behaviors.LiveNowTimer);
    expect(liveNow?.state.enabled).toEqual(dash.liveNow);

    const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);
    expect(transformCursorSynctoEnum(cursorSync?.state.sync)).toEqual(dash.cursorSync);

    // Dashboard links
    expect(scene.state.links).toHaveLength(dash.links.length);
    expect(scene.state.links![0].title).toBe(dash.links[0].title);

    // Time settings
    const time = dash.timeSettings;
    const refreshPicker = dashboardSceneGraph.getRefreshPicker(scene)!;
    const timeRange = sceneGraph.getTimeRange(scene)!;

    // Time settings
    expect(refreshPicker.state.refresh).toEqual(time.autoRefresh);
    expect(refreshPicker.state.intervals).toEqual(time.autoRefreshIntervals);
    expect(timeRange?.state.fiscalYearStartMonth).toEqual(dash.timeSettings.fiscalYearStartMonth);
    expect(timeRange?.state.value.raw).toEqual({ from: dash.timeSettings.from, to: dash.timeSettings.to });
    expect(dashboardControls.state.hideTimeControls).toEqual(dash.timeSettings.hideTimepicker);
    expect(timeRange?.state.UNSAFE_nowDelay).toEqual(dash.timeSettings.nowDelay);
    expect(timeRange?.state.timeZone).toEqual(dash.timeSettings.timezone);
    expect(timeRange?.state.weekStart).toEqual(dash.timeSettings.weekStart);
    expect(dashboardControls).toBeDefined();
    expect(dashboardControls.state.refreshPicker.state.intervals).toEqual(time.autoRefreshIntervals);
    expect(dashboardControls.state.hideTimeControls).toBe(time.hideTimepicker);

    // Variables
    const variables = scene.state?.$variables;
    expect(variables?.state.variables).toHaveLength(dash.variables.length);
    validateVariable({
      sceneVariable: variables?.state.variables[0],
      variableKind: dash.variables[0] as QueryVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: QueryVariable,
      index: 0,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[1],
      variableKind: dash.variables[1] as CustomVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: CustomVariable,
      index: 1,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[2],
      variableKind: dash.variables[2] as DatasourceVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: DataSourceVariable,
      index: 2,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[3],
      variableKind: dash.variables[3] as ConstantVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: ConstantVariable,
      index: 3,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[4],
      variableKind: dash.variables[4] as IntervalVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: IntervalVariable,
      index: 4,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[5],
      variableKind: dash.variables[5] as TextVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: TextBoxVariable,
      index: 5,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[6],
      variableKind: dash.variables[6] as GroupByVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: GroupByVariable,
      index: 6,
    });
    validateVariable({
      sceneVariable: variables?.state.variables[7],
      variableKind: dash.variables[7] as AdhocVariableKind,
      scene: scene,
      dashSpec: dash,
      sceneVariableClass: AdHocFiltersVariable,
      index: 7,
    });

    // Annotations
    expect(scene.state.$data).toBeInstanceOf(DashboardDataLayerSet);
    const dataLayers = scene.state.$data as DashboardDataLayerSet;
    expect(dataLayers.state.annotationLayers).toHaveLength(dash.annotations.length);
    expect(dataLayers.state.annotationLayers[0].state.name).toBe(dash.annotations[0].spec.name);
    expect(dataLayers.state.annotationLayers[0].state.isEnabled).toBe(dash.annotations[0].spec.enable);
    expect(dataLayers.state.annotationLayers[0].state.isHidden).toBe(dash.annotations[0].spec.hide);

    // Enabled
    expect(dataLayers.state.annotationLayers[1].state.name).toBe(dash.annotations[1].spec.name);
    expect(dataLayers.state.annotationLayers[1].state.isEnabled).toBe(dash.annotations[1].spec.enable);
    expect(dataLayers.state.annotationLayers[1].state.isHidden).toBe(dash.annotations[1].spec.hide);

    // Disabled
    expect(dataLayers.state.annotationLayers[2].state.name).toBe(dash.annotations[2].spec.name);
    expect(dataLayers.state.annotationLayers[2].state.isEnabled).toBe(dash.annotations[2].spec.enable);
    expect(dataLayers.state.annotationLayers[2].state.isHidden).toBe(dash.annotations[2].spec.hide);

    // Hidden
    expect(dataLayers.state.annotationLayers[3].state.name).toBe(dash.annotations[3].spec.name);
    expect(dataLayers.state.annotationLayers[3].state.isEnabled).toBe(dash.annotations[3].spec.enable);
    expect(dataLayers.state.annotationLayers[3].state.isHidden).toBe(dash.annotations[3].spec.hide);

    // To be implemented
    // expect(timePicker.state.ranges).toEqual(dash.timeSettings.quickRanges);

    // VizPanel
    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels).toHaveLength(1);
    const vizPanel = vizPanels[0];
    validateVizPanel(vizPanel, dash);

    // Layout
    const layout = scene.state.body as DefaultGridLayoutManager;
    expect(layout.state.grid.state.children.length).toBe(1);
    expect(layout.state.grid.state.children[0].state.key).toBe(`grid-item-${dash.elements['panel-1'].spec.id}`);
    const gridLayoutItemSpec = dash.layout.spec.items[0].spec;
    expect(layout.state.grid.state.children[0].state.width).toBe(gridLayoutItemSpec.width);
    expect(layout.state.grid.state.children[0].state.height).toBe(gridLayoutItemSpec.height);
    expect(layout.state.grid.state.children[0].state.x).toBe(gridLayoutItemSpec.x);
    expect(layout.state.grid.state.children[0].state.y).toBe(gridLayoutItemSpec.y);

    // Transformations
    expect((vizPanel.state.$data as SceneDataTransformer)?.state.transformations[0]).toEqual(
      dash.elements['panel-1'].spec.data.spec.transformations[0].spec
    );
  });

  it('should set panel ds if it is mixed DS', () => {
    const dashboard = cloneDeep(defaultDashboard);
    dashboard.spec.elements['panel-1'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        datasource: {
          type: 'graphite',
          uid: 'datasource1',
        },
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.type).toBe('mixed');
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.uid).toBe(MIXED_DATASOURCE_NAME);
  });

  it('should set panel ds as undefined if it is not mixed DS', () => {
    const dashboard = cloneDeep(defaultDashboard);
    dashboard.spec.elements['panel-1'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        datasource: {
          type: 'prometheus',
          uid: 'datasource1',
        },
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource).toBeUndefined();
  });

  it('should set panel ds as mixed if one ds is undefined', () => {
    const dashboard = cloneDeep(defaultDashboard);

    dashboard.spec.elements['panel-1'].spec.data.spec.queries.push({
      kind: 'PanelQuery',
      spec: {
        refId: 'A',
        hidden: false,
        query: {
          kind: 'prometheus',
          spec: {
            expr: 'test-query',
          },
        },
      },
    });

    const scene = transformSaveModelSchemaV2ToScene(dashboard);

    const vizPanels = (scene.state.body as DashboardLayoutManager).getVizPanels();
    expect(vizPanels.length).toBe(1);
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.type).toBe('mixed');
    expect(getQueryRunnerFor(vizPanels[0])?.state.datasource?.uid).toBe(MIXED_DATASOURCE_NAME);
  });

  describe('When creating a snapshot dashboard scene', () => {
    it('should initialize a dashboard scene with SnapshotVariables', () => {
      const snapshot: DashboardWithAccessInfo<DashboardV2Spec> = {
        ...defaultDashboard,
        metadata: {
          ...defaultDashboard.metadata,
          annotations: {
            ...defaultDashboard.metadata.annotations,
            'grafana.app/dashboard-is-snapshot': true,
          },
        },
      };

      const scene = transformSaveModelSchemaV2ToScene(snapshot);

      // check variables were converted to snapshot variables
      expect(scene.state.$variables?.state.variables).toHaveLength(8);
      expect(scene.state.$variables?.getByName('customVar')).toBeInstanceOf(SnapshotVariable);
      expect(scene.state.$variables?.getByName('adhocVar')).toBeInstanceOf(AdHocFiltersVariable);
      expect(scene.state.$variables?.getByName('intervalVar')).toBeInstanceOf(SnapshotVariable);
      // custom snapshot
      const customSnapshot = scene.state.$variables?.getByName('customVar') as SnapshotVariable;
      expect(customSnapshot.state.value).toBe('option1');
      expect(customSnapshot.state.text).toBe('option1');
      expect(customSnapshot.state.isReadOnly).toBe(true);
      // adhoc snapshot
      const adhocSnapshot = scene.state.$variables?.getByName('adhocVar') as AdHocFiltersVariable;
      const adhocVariable = snapshot.spec.variables[7] as AdhocVariableKind;
      expect(adhocSnapshot.state.filters).toEqual(adhocVariable.spec.filters);
      expect(adhocSnapshot.state.readOnly).toBe(true);
      // interval snapshot
      const intervalSnapshot = scene.state.$variables?.getByName('intervalVar') as SnapshotVariable;
      expect(intervalSnapshot.state.value).toBe('1m');
      expect(intervalSnapshot.state.text).toBe('1m');
      expect(intervalSnapshot.state.isReadOnly).toBe(true);
    });
  });

  describe('meta', () => {
    describe('initializes meta based on k8s resource', () => {
      it('handles undefined access values', () => {
        const scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
        // when access metadata undefined
        expect(scene.state.meta.canShare).toBe(true);
        expect(scene.state.meta.canSave).toBe(true);
        expect(scene.state.meta.canStar).toBe(true);
        expect(scene.state.meta.canEdit).toBe(true);
        expect(scene.state.meta.canDelete).toBe(true);
        expect(scene.state.meta.canAdmin).toBe(true);
        expect(scene.state.meta.annotationsPermissions).toBe(undefined);

        expect(scene.state.meta.url).toBe('/d/abc');
        expect(scene.state.meta.slug).toBe('what-a-dashboard');
        expect(scene.state.meta.created).toBe('creationTs');
        expect(scene.state.meta.createdBy).toBe('user:createBy');
        expect(scene.state.meta.updated).toBe('updatedTs');
        expect(scene.state.meta.updatedBy).toBe('user:updatedBy');
        expect(scene.state.meta.folderUid).toBe('folder-uid');
        expect(scene.state.meta.version).toBe(123);
      });

      it('handles access metadata values', () => {
        const dashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
          ...defaultDashboard,
          access: {
            canSave: false,
            canEdit: false,
            canDelete: false,
            canShare: false,
            canStar: false,
            canAdmin: false,
            annotationsPermissions: {
              dashboard: {
                canAdd: false,
                canEdit: false,
                canDelete: false,
              },
              organization: {
                canAdd: false,
                canEdit: false,
                canDelete: false,
              },
            },
          },
        };
        const scene = transformSaveModelSchemaV2ToScene(dashboard);

        expect(scene.state.meta.canShare).toBe(false);
        expect(scene.state.meta.canSave).toBe(false);
        expect(scene.state.meta.canStar).toBe(false);
        expect(scene.state.meta.canEdit).toBe(false);
        expect(scene.state.meta.canDelete).toBe(false);
        expect(scene.state.meta.canAdmin).toBe(false);
        expect(scene.state.meta.annotationsPermissions).toEqual(dashboard.access.annotationsPermissions);
        expect(scene.state.meta.version).toBe(123);
      });
    });

    describe('Editable false dashboard', () => {
      let dashboard: DashboardWithAccessInfo<DashboardV2Spec>;

      beforeEach(() => {
        dashboard = {
          ...cloneDeep(defaultDashboard),
          spec: {
            ...defaultDashboard.spec,
            editable: false,
          },
        };
      });
      it('Should set meta canEdit and canSave to false', () => {
        const scene = transformSaveModelSchemaV2ToScene(dashboard);
        expect(scene.state.meta.canMakeEditable).toBe(true);

        expect(scene.state.meta.canSave).toBe(false);
        expect(scene.state.meta.canEdit).toBe(false);
        expect(scene.state.meta.canDelete).toBe(false);
      });

      describe('when does not have save permissions', () => {
        it('Should set meta correct meta', () => {
          dashboard.access.canSave = false;
          const scene = transformSaveModelSchemaV2ToScene(dashboard);
          expect(scene.state.meta.canMakeEditable).toBe(false);

          expect(scene.state.meta.canSave).toBe(false);
          expect(scene.state.meta.canEdit).toBe(false);
          expect(scene.state.meta.canDelete).toBe(false);
        });
      });
    });

    describe('Editable true dashboard', () => {
      let dashboard: DashboardWithAccessInfo<DashboardV2Spec>;

      beforeEach(() => {
        dashboard = {
          ...cloneDeep(defaultDashboard),
          spec: {
            ...defaultDashboard.spec,
            editable: true,
          },
        };
      });
      it('Should set meta canEdit and canSave to false', () => {
        const scene = transformSaveModelSchemaV2ToScene(dashboard);

        expect(scene.state.meta.canMakeEditable).toBe(false);

        expect(scene.state.meta.canSave).toBe(true);
        expect(scene.state.meta.canEdit).toBe(true);
        expect(scene.state.meta.canDelete).toBe(true);
      });
    });

    describe('is new dashboard handling', () => {
      it('handles undefined is new dashbaord annotation', () => {
        const scene = transformSaveModelSchemaV2ToScene(defaultDashboard);
        expect(scene.state.meta.isNew).toBe(false);
      });
      it('handles defined is new dashbaord annotation', () => {
        const dashboard: DashboardWithAccessInfo<DashboardV2Spec> = {
          ...defaultDashboard,
          metadata: {
            ...defaultDashboard.metadata,
            annotations: {
              ...defaultDashboard.metadata.annotations,
              [AnnoKeyDashboardIsNew]: true,
            },
          },
        };
        const scene = transformSaveModelSchemaV2ToScene(dashboard);
        expect(scene.state.meta.isNew).toBe(true);
      });
    });
  });
});
