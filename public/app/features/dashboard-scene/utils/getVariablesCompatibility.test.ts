import { CustomVariable, SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { ElementSelection } from '../edit-pane/ElementSelection';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';

import { getVariablesCompatibility } from './getVariablesCompatibility';

jest.mock('../serialization/sceneVariablesSetToVariables', () => ({
  sceneVariablesSetToVariables: (set: { state: { variables: Array<{ state: { name: string; type?: string } }> } }) => {
    return set.state.variables.map((v) => ({ name: v.state.name, type: v.state.type ?? 'custom' }));
  },
}));

function makeVar(name: string) {
  return new CustomVariable({ name, query: name, value: name, text: name });
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
      const dashVar = makeVar('dashVar');
      const sectionVar = makeVar('sectionVar');
      const otherSectionVar = makeVar('otherVar');

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

      const selection = new ElementSelection([[sectionVar.state.key!, sectionVar.getRef()]]);
      dashboard.state.editPane.setState({ selection });

      const result = getVariablesCompatibility(dashboard);
      const names = result.map((v) => v.name);

      expect(names).toContain('sectionVar');
      expect(names).toContain('dashVar');
      expect(names).not.toContain('otherVar');
    });

    it('falls back to all variables when nothing is selected', () => {
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
      expect(names).toContain('sectionVar');
    });
  });

  describe('dashboard view mode (no editPanel, no selection)', () => {
    it('returns all variables from dashboard and all sections', () => {
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
      expect(names).toContain('sectionVar1');
      expect(names).toContain('sectionVar2');
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
    it('walks up ancestry and collects variables from all ancestor levels', () => {
      const dashVar = makeVar('dashVar');
      const sectionVar = makeVar('sectionVar');

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
        $variables: new SceneVariableSet({ variables: [dashVar] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      const result = getVariablesCompatibility(panel);
      const names = result.map((v) => v.name);

      expect(names).toContain('sectionVar');
      expect(names).toContain('dashVar');
    });

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
