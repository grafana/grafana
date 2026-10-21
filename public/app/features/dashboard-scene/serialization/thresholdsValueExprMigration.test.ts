import { type FieldConfigSource, ThresholdsMode } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { type VizPanel } from '@grafana/scenes';
import {
  type FieldConfigSource as FieldConfigSourceV2,
  type PanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type DashboardDataDTO } from 'app/types/dashboard';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getTestDashboardSceneFromSaveModel } from '../utils/test-utils';

import { migrateThresholdValueExprs } from './thresholdsValueExprMigration';
import { transformSaveModelToScene } from './transformSaveModelToScene';
import { transformSceneToSaveModel } from './transformSceneToSaveModel';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

const withValueExprs = (): FieldConfigSource => ({
  defaults: {
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green', valueExpr: '$base' },
        { value: 50, color: 'orange', valueExpr: '$warn' },
        { value: 80, color: 'red' },
      ],
    },
  },
  overrides: [
    {
      matcher: { id: 'byName', options: 'A' },
      properties: [
        {
          id: 'thresholds',
          value: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'blue' },
              { value: 10, color: 'purple', valueExpr: '$low' },
            ],
          },
        },
      ],
    },
  ],
});

const migrated = (): FieldConfigSource => ({
  defaults: {
    thresholds: {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 50, color: 'orange' },
        { value: 80, color: 'red' },
      ],
    },
    varMappings: { 'thresholds.steps.1': '$warn' },
  },
  overrides: [
    {
      matcher: { id: 'byName', options: 'A' },
      properties: [
        {
          id: 'thresholds',
          value: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'blue' },
              { value: 10, color: 'purple' },
            ],
          },
        },
        { id: 'varMappings.thresholds.steps.1', value: '$low' },
      ],
    },
  ],
});

describe('migrateThresholdValueExprs', () => {
  afterEach(() => {
    setTestFlags();
  });

  describe('with the flag on', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaPanelOptionInterpolation]: true });
    });

    it('moves step valueExprs into varMappings in defaults and overrides and drops the base step expression', () => {
      expect(migrateThresholdValueExprs(withValueExprs())).toEqual(migrated());
    });

    it('keeps an existing mapping over the valueExpr', () => {
      const fieldConfig = withValueExprs();
      fieldConfig.defaults.varMappings = { 'thresholds.steps.1': '$existing', min: '$min' };
      fieldConfig.overrides[0].properties.push({ id: 'varMappings.thresholds.steps.1', value: '$existingOverride' });

      const result = migrateThresholdValueExprs(fieldConfig);

      expect(result.defaults.varMappings).toEqual({ 'thresholds.steps.1': '$existing', min: '$min' });
      expect(result.defaults.thresholds?.steps.some((step) => 'valueExpr' in step)).toBe(false);
      expect(result.overrides[0].properties).toEqual([
        migrated().overrides[0].properties[0],
        { id: 'varMappings.thresholds.steps.1', value: '$existingOverride' },
      ]);
    });

    it('returns the same object when there is nothing to migrate', () => {
      const fieldConfig = migrated();
      expect(migrateThresholdValueExprs(fieldConfig)).toBe(fieldConfig);
    });
  });

  it('leaves the field config unchanged with the flag off', () => {
    const fieldConfig = withValueExprs();
    expect(migrateThresholdValueExprs(fieldConfig)).toBe(fieldConfig);
    expect(fieldConfig).toEqual(withValueExprs());
  });
});

describe('threshold valueExpr migration at load time', () => {
  afterEach(() => {
    setTestFlags();
  });

  function loadV1(fieldConfig: FieldConfigSource) {
    return transformSaveModelToScene({
      dashboard: {
        title: 'v1',
        uid: 'v1',
        schemaVersion: 42,
        panels: [{ id: 1, type: 'timeseries', title: 'Panel', gridPos: { x: 0, y: 0, w: 12, h: 8 }, fieldConfig }],
      } as DashboardDataDTO,
      meta: {},
    });
  }

  function loadV2(fieldConfig: FieldConfigSource) {
    const panel: PanelKind = {
      kind: 'Panel',
      spec: {
        id: 1,
        title: 'Panel',
        description: '',
        links: [],
        data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
        vizConfig: {
          kind: 'VizConfig',
          group: 'timeseries',
          version: '',
          spec: {
            options: {},
            fieldConfig: fieldConfig as FieldConfigSourceV2,
          },
        },
      },
    };
    return getTestDashboardSceneFromSaveModel({ elements: { 'panel-1': panel } });
  }

  function expectSavedVarMappings(
    fieldConfig: { defaults: object; overrides: Array<{ properties: unknown[] }> } | undefined
  ) {
    expect(fieldConfig?.defaults).toMatchObject({ varMappings: { 'thresholds.steps.1': '$warn' } });
    expect(fieldConfig?.overrides[0].properties).toContainEqual({
      id: 'varMappings.thresholds.steps.1',
      value: '$low',
    });
  }

  const panelFieldConfig = (scene: ReturnType<typeof loadV1>) =>
    (dashboardSceneGraph.getVizPanels(scene)[0] as VizPanel).state.fieldConfig;

  it('migrates v1 panels with the flag on, and the saved model has varMappings and no valueExpr', () => {
    setTestFlags({ [FlagKeys.GrafanaPanelOptionInterpolation]: true });
    const scene = loadV1(withValueExprs());

    expect(panelFieldConfig(scene)).toEqual(migrated());
    expect(scene.state.isDirty).toBeFalsy();
    const saved = transformSceneToSaveModel(scene);
    const savedPanel = saved.panels?.[0];
    expectSavedVarMappings(savedPanel && 'fieldConfig' in savedPanel ? savedPanel.fieldConfig : undefined);
    expect(JSON.stringify(saved)).not.toContain('valueExpr');
  });

  it('leaves v1 panels unchanged with the flag off', () => {
    const scene = loadV1(withValueExprs());

    expect(panelFieldConfig(scene)).toEqual(withValueExprs());
  });

  it('migrates v2 panels with the flag on, and the saved model has varMappings and no valueExpr', () => {
    setTestFlags({ [FlagKeys.GrafanaPanelOptionInterpolation]: true });
    const scene = loadV2(withValueExprs());

    expect(panelFieldConfig(scene)).toEqual(migrated());
    expect(scene.state.isDirty).toBeFalsy();
    const saved = transformSceneToSaveModelSchemaV2(scene);
    const savedPanel = saved.elements['panel-1'];
    expectSavedVarMappings(savedPanel.kind === 'Panel' ? savedPanel.spec.vizConfig.spec.fieldConfig : undefined);
    expect(JSON.stringify(saved)).not.toContain('valueExpr');
  });

  it('leaves v2 panels unchanged with the flag off', () => {
    const scene = loadV2(withValueExprs());

    expect(panelFieldConfig(scene)).toEqual(withValueExprs());
  });
});
