import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  SceneDataTransformer,
  SceneObject,
  SceneQueryRunner,
  SceneVariable,
  SceneVariableState,
  VizPanel,
} from '@grafana/scenes';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';

import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';
import { TypedVariableModelV2 } from '../serialization/transformSaveModelSchemaV2ToScene';
import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

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
  if (sceneVariable instanceof CustomVariable && variableKind.kind === 'CustomVariable') {
    expect(sceneVariable?.state.query).toBe(variableKind.spec.query);
  }
}

export function validateVizPanel(vizPanel: VizPanel, dash: DashboardV2Spec) {
  expect(vizPanel.state.title).toBe(dash.elements['panel-1'].spec.title);
  expect(vizPanel.state.description).toBe(dash.elements['panel-1'].spec.description);
  expect(vizPanel.state.pluginId).toBe(dash.elements['panel-1'].spec.vizConfig.kind);
  expect(vizPanel.state.pluginVersion).toBe(dash.elements['panel-1'].spec.vizConfig.spec.pluginVersion);
  expect(vizPanel.state.options).toEqual(dash.elements['panel-1'].spec.vizConfig.spec.options);
  expect(vizPanel.state.fieldConfig).toEqual(dash.elements['panel-1'].spec.vizConfig.spec.fieldConfig);
  expect(getPanelIdForVizPanel(vizPanel)).toBe(dash.elements['panel-1'].spec.id);
  expect(vizPanel.state.displayMode).toBe(dash.elements['panel-1'].spec.transparent ? 'transparent' : 'default');

  expect(vizPanel.state.$data).toBeInstanceOf(SceneDataTransformer);
  const dataTransformer = vizPanel.state.$data as SceneDataTransformer;
  expect(dataTransformer.state.transformations[0]).toEqual(
    dash.elements['panel-1'].spec.data.spec.transformations[0].spec
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
  const titleItems = vizPanel.state.titleItems as SceneObject[];
  const vizPanelLinks = titleItems[0] as VizPanelLinks;
  expect(vizPanelLinks.state.rawLinks).toHaveLength(dash.elements['panel-1'].spec.links.length);
  expect(vizPanelLinks.state.rawLinks).toEqual(dash.elements['panel-1'].spec.links);
  expect(queryRunner.state.dataLayerFilter?.panelId).toBe(dash.elements['panel-1'].spec.id);
}
