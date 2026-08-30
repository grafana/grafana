import { CustomVariable, SceneGridLayout, SceneVariableSet, ScopesVariable, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { collectAncestorSceneVariables } from './collectAncestorSceneVariables';

function buildRowFixture({
  dashboardVariables,
  sectionVariables,
}: {
  dashboardVariables: CustomVariable[];
  sectionVariables: CustomVariable[];
}) {
  const panel = new VizPanel({ key: 'p1', pluginId: 'text' });
  const gridItem = new DashboardGridItem({ body: panel });
  const row = new RowItem({
    title: 'R',
    $variables: new SceneVariableSet({ variables: sectionVariables }),
    layout: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [gridItem] }),
    }),
  });
  new DashboardScene({
    $variables: new SceneVariableSet({ variables: dashboardVariables }),
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return { gridItem, row };
}

describe('collectAncestorSceneVariables', () => {
  it('includes dashboard variables when sceneObject is the scene root (no parent)', () => {
    const dashVar = new CustomVariable({ name: 'dashVar', query: 'd', value: 'd', text: 'd' });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [dashVar] }),
    });

    const merged = collectAncestorSceneVariables(dashboard);
    expect(merged.map((v) => v.state.name)).toEqual(['dashVar']);
  });

  it('merges dashboard and section variables with inner scope winning on duplicate names (from grid item)', () => {
    const dashVar = new CustomVariable({ name: 'dup', query: 'd', value: 'd', text: 'd' });
    const sectionDup = new CustomVariable({ name: 'dup', query: 's', value: 's', text: 's' });
    const sectionOnly = new CustomVariable({ name: 'sectionOnly', query: 'x', value: 'x', text: 'x' });

    const { gridItem } = buildRowFixture({
      dashboardVariables: [dashVar],
      sectionVariables: [sectionDup, sectionOnly],
    });

    const merged = collectAncestorSceneVariables(gridItem);
    const names = merged.map((v) => v.state.name);

    expect(names).toContain('sectionOnly');
    expect(names).toContain('dup');
    const dupInstance = merged.find((v) => v.state.name === 'dup');
    expect(dupInstance).toBe(sectionDup);
  });

  it('excludes system variables (keepOnlyUserDefinedVariables)', () => {
    const userVar = new CustomVariable({ name: 'userVar', query: 'x', value: 'x', text: 'x' });
    const scopesVar = new ScopesVariable({ enable: true });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [userVar, scopesVar] }),
    });

    const merged = collectAncestorSceneVariables(dashboard);
    expect(merged.map((v) => v.state.name)).toEqual(['userVar']);
  });

  it('excludes the starting row section variables (walk starts at parent when present)', () => {
    const dashVar = new CustomVariable({ name: 'dashVar', query: 'd', value: 'd', text: 'd' });
    const sectionVar = new CustomVariable({ name: 'sectionVar', query: 's', value: 's', text: 's' });

    const { row } = buildRowFixture({
      dashboardVariables: [dashVar],
      sectionVariables: [sectionVar],
    });

    const merged = collectAncestorSceneVariables(row);
    const names = merged.map((v) => v.state.name);

    expect(names).toContain('dashVar');
    expect(names).not.toContain('sectionVar');
  });
});
