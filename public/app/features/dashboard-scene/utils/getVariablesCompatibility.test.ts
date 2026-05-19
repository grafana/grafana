import { CustomVariable, QueryVariable, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { getVariablesCompatibility } from './getVariablesCompatibility';

jest.mock('../serialization/sceneVariablesSetToVariables', () => ({
  sceneVariablesSetToVariables: (
    set: { state: { variables: Array<{ state: { name: string; type?: string } }> } },
    _keepQueryOptions?: boolean,
    excludeVariable?: unknown
  ) => {
    return set.state.variables
      .filter((v) => v !== excludeVariable)
      .map((v) => ({ name: v.state.name, type: v.state.type ?? 'custom' }));
  },
}));

function makeVar(name: string) {
  return new CustomVariable({ name, query: name, value: name, text: name });
}

function makeQueryVar(name: string) {
  return new QueryVariable({ name, query: '', value: '', text: '' });
}

describe('getVariablesCompatibility', () => {
  describe('panel editing mode', () => {
    it('returns only ancestor variables (section + dashboard)', () => {
      const dashVar = makeVar('dashVar');
      const sectionVar = makeVar('sectionVar');
      const otherSectionVar = makeVar('otherVar');

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const gridItem = new DashboardGridItem({ body: panel });

      const row1 = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar] }),
        layout: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      const row2 = new RowItem({
        title: 'Row 2',
        $variables: new SceneVariableSet({ variables: [otherSectionVar] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row1, row2] }),
      });

      dashboard.setState({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        editPanel: { state: { panelRef: { resolve: () => panel } } } as any,
      });

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('sectionVar');
      expect(names).toContain('dashVar');
      expect(names).not.toContain('otherVar');
    });
  });

  describe('edit pane selection', () => {
    it('scopes to the selected object ancestry', () => {
      const dashVar = makeQueryVar('dashVar');
      const sectionVar = makeQueryVar('sectionVar');
      const otherSectionVar = makeQueryVar('otherVar');

      const row1 = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar] }),
      });

      const row2 = new RowItem({
        title: 'Row 2',
        $variables: new SceneVariableSet({ variables: [otherSectionVar] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row1, row2] }),
      });

      dashboard.state.editPane.selectObject(sectionVar);

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('dashVar');
      expect(names).not.toContain('sectionVar');
      expect(names).not.toContain('otherVar');
    });

    it('falls back to global variables when nothing is selected', () => {
      const dashVar = makeVar('dashVar');
      const sectionVar = makeVar('sectionVar');

      const row = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('dashVar');
      expect(names).not.toContain('sectionVar');
    });

    it('excludes the currently selected query variable from ancestry results', () => {
      const dashVar = makeVar('dashVar');
      const queryVar = makeQueryVar('queryVar');

      const row = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [queryVar] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      dashboard.state.editPane.selectObject(queryVar);

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('dashVar');
      expect(names).not.toContain('queryVar');
    });
  });

  describe('dashboard view mode (no editPanel, no selection)', () => {
    it('returns global variables from dashboard', () => {
      const dashVar = makeVar('dashVar');
      const sectionVar1 = makeVar('sectionVar1');
      const sectionVar2 = makeVar('sectionVar2');

      const row1 = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar1] }),
      });

      const row2 = new RowItem({
        title: 'Row 2',
        $variables: new SceneVariableSet({ variables: [sectionVar2] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row1, row2] }),
      });

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('dashVar');
      expect(names).not.toContain('sectionVar1');
      expect(names).not.toContain('sectionVar2');
    });

    it('deduplicates: dashboard variables take precedence over section variables with the same name', () => {
      const dashVar = makeVar('sharedName');
      const sectionVar = makeVar('sharedName');

      const row = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar] }),
      });

      const dashboard = new DashboardScene({
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      const result = getVariablesCompatibility(dashboard);
      const matched = result.filter((v) => v.name === 'sharedName');

      expect(matched).toHaveLength(1);
    });
  });

  describe('called with a child scene object (not the DashboardScene root)', () => {
    it('gives precedence to closer ancestor variables on name collision', () => {
      const sectionVar = makeVar('sharedName');

      const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
      const gridItem = new DashboardGridItem({ body: panel });

      const row = new RowItem({
        title: 'Row 1',
        $variables: new SceneVariableSet({ variables: [sectionVar] }),
        layout: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({ children: [gridItem] }),
        }),
      });

      new DashboardScene({
        $variables: new SceneVariableSet({ variables: [makeVar('sharedName')] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      const result = getVariablesCompatibility(panel);
      const matched = result.filter((v) => v.name === 'sharedName');

      expect(matched).toHaveLength(1);
    });
  });
});
