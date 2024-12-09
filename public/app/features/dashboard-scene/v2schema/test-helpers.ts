import {
  AdHocFiltersVariable,
  DataSourceVariable,
  GroupByVariable,
  QueryVariable,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariable,
  SceneVariableState,
  VizPanel,
} from '@grafana/scenes';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

import { DashboardScene } from '../scene/DashboardScene';
import { TypedVariableModelV2 } from '../serialization/transformSaveModelSchemaV2ToScene';
import { getQueryRunnerFor } from '../utils/utils';

type SceneVariableConstructor<T extends SceneVariableState, V extends SceneVariable<T>> = new (
  initialState: Partial<T>
) => V;

interface VariableValidation<T extends TypedVariableModelV2, S extends SceneVariableState, V extends SceneVariable<S>> {
  sceneVariable: SceneVariable<SceneVariableState> | undefined;
  variableKind: T;
  scene: DashboardScene;
  dashSpec: DashboardV2Spec;
  sceneVariableClass: SceneVariableConstructor<S, V>;
  index: number;
}

export function validateVariable<
  T extends TypedVariableModelV2,
  S extends SceneVariableState,
  V extends SceneVariable<S>,
>({ sceneVariable, variableKind, scene, dashSpec, sceneVariableClass, index }: VariableValidation<T, S, V>) {
  if (variableKind.kind === 'AdhocVariable' && sceneVariable instanceof AdHocFiltersVariable) {
    expect(sceneVariable).toBeInstanceOf(AdHocFiltersVariable);
    expect(scene.state?.$variables?.getByName(dashSpec.variables[index].spec.name)?.getValue()).toBe(
      `${variableKind.spec.filters[0].key}="${variableKind.spec.filters[0].value}"`
    );
    expect(sceneVariable?.state.datasource).toEqual(variableKind.spec.datasource);
  } else if (variableKind.kind !== 'AdhocVariable') {
    expect(sceneVariable).toBeInstanceOf(sceneVariableClass);
    expect(scene.state?.$variables?.getByName(dashSpec.variables[index].spec.name)?.getValue()).toBe(
      variableKind.spec.current.value
    );
  }
  if (sceneVariable instanceof DataSourceVariable && variableKind.kind === 'DatasourceVariable') {
    expect(sceneVariable?.state.pluginId).toBe(variableKind.spec.pluginId);
  }
  if (sceneVariable instanceof QueryVariable && variableKind.kind === 'QueryVariable') {
    expect(sceneVariable?.state.datasource).toBe(variableKind.spec.datasource);
    expect(sceneVariable?.state.query).toBe(variableKind.spec.query);
  }
  if (sceneVariable instanceof GroupByVariable && variableKind.kind === 'CustomVariable') {
    expect(sceneVariable?.state.datasource).toBe(variableKind.spec.query);
  }
}

export function validateVizPanel(vizPanel: VizPanel, dash: DashboardV2Spec) {
  expect(vizPanel.state.title).toBe(dash.elements['test-panel-uid'].spec.title);
  expect(vizPanel.state.description).toBe(dash.elements['test-panel-uid'].spec.description);
  expect(vizPanel.state.pluginId).toBe(dash.elements['test-panel-uid'].spec.vizConfig.kind);
  expect(vizPanel.state.pluginVersion).toBe(dash.elements['test-panel-uid'].spec.vizConfig.spec.pluginVersion);
  expect(vizPanel.state.options).toEqual(dash.elements['test-panel-uid'].spec.vizConfig.spec.options);
  expect(vizPanel.state.fieldConfig).toEqual(dash.elements['test-panel-uid'].spec.vizConfig.spec.fieldConfig);
  expect(vizPanel.state.key).toBe(dash.elements['test-panel-uid'].spec.uid);

  expect(vizPanel.state.$data).toBeInstanceOf(SceneDataTransformer);
  const dataTransformer = vizPanel.state.$data as SceneDataTransformer;
  expect(dataTransformer.state.transformations[0]).toEqual(
    dash.elements['test-panel-uid'].spec.data.spec.transformations[0].spec
  );

  expect(dataTransformer.state.$data).toBeInstanceOf(SceneQueryRunner);
  const queryRunner = getQueryRunnerFor(vizPanel)!;
  expect(queryRunner).toBeInstanceOf(SceneQueryRunner);
  expect(queryRunner.state.queries).toEqual([
    { datasource: { type: 'prometheus', uid: 'datasource1' }, expr: 'test-query', hide: false, refId: 'A' },
  ]);
  expect(queryRunner.state.maxDataPoints).toBe(100);
  expect(queryRunner.state.cacheTimeout).toBe('1m');
  expect(queryRunner.state.queryCachingTTL).toBe(60);
  expect(queryRunner.state.minInterval).toBe('1m');
  // FIXME: This is asking for a number as panel ID but here the uid of a panel is string
  // will be fixed once scenes package is updated to support string panel ID
  // expect(queryRunner.state.dataLayerFilter?.panelId).toBe(0);
}
