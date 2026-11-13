import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  ConstantVariable,
  CustomVariable,
  SceneVariableSet,
  ScopesVariable,
  SwitchVariable,
  TextBoxVariable,
  VizPanel,
} from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { activateFullSceneTree } from '../utils/test-utils';

import { getVarMappingVariableSource } from './getVarMappingVariableSource';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'timeseries' })),
  getPanelPluginFromCache: () => undefined,
});

function buildScene() {
  const panel = new VizPanel({ title: 'Panel', pluginId: 'timeseries', key: 'panel-1' });
  const variableSet = new SceneVariableSet({
    variables: [
      new CustomVariable({ name: 'style', query: 'Lines : line,bars', value: 'line', text: 'Lines' }),
      new CustomVariable({ name: 'dependent', query: '$style,points', value: 'points', text: 'points' }),
      new SwitchVariable({ name: 'sw', value: 'on', enabledValue: 'on', disabledValue: 'off' }),
      new ConstantVariable({ name: 'c', value: 'bars' }),
      new TextBoxVariable({ name: 'text', value: 'free' }),
    ],
  });
  const scene = new DashboardScene({
    title: 'Dashboard',
    uid: 'dash',
    $variables: variableSet,
    body: DefaultGridLayoutManager.fromVizPanels([panel]),
  });
  activateFullSceneTree(scene);
  return { panel, variableSet };
}

describe('getVarMappingVariableSource', () => {
  it('lists the variables with their current value and the values known without a query', () => {
    const { panel } = buildScene();

    expect(getVarMappingVariableSource(panel).getVariables()).toEqual([
      {
        name: 'style',
        current: 'Lines',
        values: [
          { value: 'line', label: 'Lines' },
          { value: 'bars', label: 'bars' },
        ],
      },
      { name: 'dependent', current: 'points', values: undefined },
      {
        name: 'sw',
        current: 'on',
        values: [
          { value: 'on', label: 'on' },
          { value: 'off', label: 'off' },
        ],
      },
      { name: 'c', current: 'bars', values: [{ value: 'bars', label: 'bars' }] },
      { name: 'text', current: 'free', values: undefined },
    ]);
  });

  it('leaves out system variables', () => {
    const { panel, variableSet } = buildScene();
    variableSet.setState({ variables: [...variableSet.state.variables, new ScopesVariable({})] });

    expect(
      getVarMappingVariableSource(panel)
        .getVariables()
        .map((variable) => variable.name)
    ).not.toContain('__scopes');
  });

  it('interpolates through the panel', () => {
    const { panel } = buildScene();

    expect(getVarMappingVariableSource(panel).interpolate('${style}')).toBe('line');
  });

  it('reports value changes and added variables', () => {
    const { panel, variableSet } = buildScene();
    const onChange = jest.fn();
    const unsubscribe = getVarMappingVariableSource(panel).subscribe(onChange);

    (variableSet.state.variables[0] as CustomVariable).changeValueTo('bars');
    expect(onChange).toHaveBeenCalledTimes(1);

    variableSet.setState({ variables: [...variableSet.state.variables, new TextBoxVariable({ name: 'more' })] });
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    (variableSet.state.variables[0] as CustomVariable).changeValueTo('line');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('adds a custom variable with label and value entries to the dashboard set', () => {
    const { panel, variableSet } = buildScene();

    getVarMappingVariableSource(panel).createVariable!({
      name: 'drawStyle',
      type: 'custom',
      values: [
        { value: 'line', label: 'Lines' },
        { value: 'a,b', label: 'a,b' },
      ],
      current: 'line',
    });

    const created = variableSet.state.variables.at(-1);
    expect(created).toBeInstanceOf(CustomVariable);
    expect(created?.state).toMatchObject({
      name: 'drawStyle',
      query: 'Lines : line,a\\,b',
      value: 'line',
      text: 'Lines',
    });
    expect(panel.interpolate('${drawStyle}')).toBe('line');
  });

  it('reuses the closest variable with the name instead of adding one', () => {
    const { panel, variableSet } = buildScene();
    panel.setState({
      $variables: new SceneVariableSet({ variables: [new CustomVariable({ name: 'local', query: 'a,b' })] }),
    });
    const { createVariable } = getVarMappingVariableSource(panel);
    const create = (name: string) =>
      createVariable!({ name, type: 'custom', values: [{ value: 'x', label: 'x' }], current: 'x' });
    const count = variableSet.state.variables.length;

    // One in the panel's own set, and one in the dashboard set, which the panel's list doesn't show
    create('local');
    create('style');

    expect(variableSet.state.variables).toHaveLength(count);
  });

  it('lists the variables of every set up to the dashboard, the closest first', () => {
    const { panel } = buildScene();
    panel.setState({
      $variables: new SceneVariableSet({
        variables: [
          new CustomVariable({ name: 'local', query: 'a,b' }),
          new ConstantVariable({ name: 'style', value: 'points' }),
        ],
      }),
    });

    const listed = getVarMappingVariableSource(panel).getVariables();

    expect(listed.map((variable) => variable.name)).toEqual(['local', 'style', 'dependent', 'sw', 'c', 'text']);
    expect(listed.find((variable) => variable.name === 'style')?.current).toBe('points');
  });

  it('says whether a variable with the name is in scope after creating it', () => {
    const { panel } = buildScene();
    const { createVariable } = getVarMappingVariableSource(panel);

    expect(createVariable!({ name: 'style', type: 'custom', values: [], current: '' })).toBe(true);
    expect(createVariable!({ name: 'fresh', type: 'switch', values: [], current: 'true' })).toBe(true);
  });

  it('adds a switch variable for booleans', () => {
    const { panel, variableSet } = buildScene();

    getVarMappingVariableSource(panel).createVariable!({
      name: 'border',
      type: 'switch',
      values: [
        { value: 'true', label: 'On' },
        { value: 'false', label: 'Off' },
      ],
      current: 'true',
    });

    const created = variableSet.state.variables.at(-1);
    expect(created).toBeInstanceOf(SwitchVariable);
    expect(created?.state).toMatchObject({ name: 'border', value: 'true' });
  });
});
