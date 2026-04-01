import { render } from '@testing-library/react';

import { CustomVariable, SceneGridLayout, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { collectDescendantVariables, VariableAdd, VariableTypeSelection } from './VariableAddEditableElement';

const defaultDsSettings = {
  name: 'TestDataSource',
  uid: 'ds1',
  type: 'test',
  meta: { id: 'test', name: 'Test' },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: string | null) => (ref === null ? defaultDsSettings : undefined),
  }),
}));

function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

function buildTestSceneWithRowSectionVariable(sectionVarName: string) {
  const sectionVar = new CustomVariable({ name: sectionVarName, query: 'a,b,c' });
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new RowsLayoutManager({
      rows: [
        new RowItem({
          title: 'Row 1',
          $variables: new SceneVariableSet({ variables: [sectionVar] }),
        }),
      ],
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

function renderTestScene() {
  const dashboard = buildTestScene();
  const variableAdd = new VariableAdd({ dashboardRef: dashboard.getRef() });
  return render(<VariableTypeSelection variableAdd={variableAdd} />);
}

describe('VariableAddEditableElement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls DashboardInteractions.newVariableTypeSelected when a variable type is clicked', () => {
    const newVariableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'newVariableTypeSelected');

    const { getByRole } = renderTestScene();

    getByRole('button', { name: /query/i }).click();

    expect(newVariableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });

  it('generates a non-conflicting name when a section variable of the same type already exists', () => {
    const dashboard = buildTestSceneWithRowSectionVariable('custom0');
    const variableAdd = new VariableAdd({ dashboardRef: dashboard.getRef() });
    const { getByRole } = render(<VariableTypeSelection variableAdd={variableAdd} />);

    getByRole('button', { name: /custom/i }).click();

    const dashboardVars = dashboard.state.$variables;
    expect(dashboardVars).toBeInstanceOf(SceneVariableSet);
    const vars = (dashboardVars as SceneVariableSet).state.variables;
    expect(vars).toHaveLength(1);
    expect(vars[0].state.name).toBe('custom1');
  });
});

describe('collectDescendantVariables', () => {
  it('returns an empty array when there are no descendant variable sets', () => {
    const dashboard = buildTestScene();
    expect(collectDescendantVariables(dashboard)).toEqual([]);
  });

  it('collects variables from row section variable sets', () => {
    const dashboard = buildTestSceneWithRowSectionVariable('custom0');
    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(1);
    expect(result[0].state.name).toBe('custom0');
  });

  it('collects variables from multiple rows', () => {
    const sectionVar1 = new CustomVariable({ name: 'custom0', query: 'a,b' });
    const sectionVar2 = new CustomVariable({ name: 'custom1', query: 'c,d' });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      isEditing: true,
      body: new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Row 1',
            $variables: new SceneVariableSet({ variables: [sectionVar1] }),
          }),
          new RowItem({
            title: 'Row 2',
            $variables: new SceneVariableSet({ variables: [sectionVar2] }),
          }),
        ],
      }),
    });
    activateFullSceneTree(dashboard);

    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.state.name)).toEqual(expect.arrayContaining(['custom0', 'custom1']));
  });
});
