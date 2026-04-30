import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  LocalValueVariable,
  type MultiValueVariable,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  UrlSyncManager,
  type VariableValueOption,
  PanelBuilders,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { RowItem } from './RowItem';
import { performRowRepeats } from './RowItemRepeater';
import { RowsLayoutManager } from './RowsLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('RowItemRepeater', () => {
  beforeEach(() => {
    locationService.replace({ search: '' });
  });

  describe('Given scene with variable with 3 values', () => {
    it('Should repeat row', async () => {
      const { rowToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Row A')).toBeInTheDocument();
        expect(screen.queryByText('Row B')).toBeInTheDocument();
        expect(screen.queryByText('Row C')).toBeInTheDocument();
      });

      expect(rowToRepeat.state.key).toBe('row-1');
      expect(rowToRepeat.state.repeatedRows!.length).toBe(2);
      expect(rowToRepeat.state.repeatedRows![0].state.key).toBe('row-1-clone-1');
    });

    it('Should update repeats when variable value changes', async () => {
      const { repeatByVariable, rowToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Row C')).toBeInTheDocument();
      });

      act(() => {
        repeatByVariable.changeValueTo(['C', 'D']);
      });

      await waitFor(() => {
        expect(screen.queryByText('Row A')).not.toBeInTheDocument();
        expect(screen.queryByText('Row D')).toBeInTheDocument();
      });

      expect(rowToRepeat.state.repeatedRows!.length).toBe(1);
    });

    it('Should skip update repeats when variable values the same', async () => {
      const { repeatByVariable, rowToRepeat } = renderScene({ variableQueryTime: 0 });
      let stateUpdates = 0;

      rowToRepeat.subscribeToState((s) => stateUpdates++);

      await waitFor(() => {
        expect(screen.queryByText('Row C')).toBeInTheDocument();
      });

      act(() => {
        repeatByVariable.changeValueTo(['A1', 'B1', 'C1']);
      });

      expect(stateUpdates).toBe(1);
    });

    it('Should render source row instead of infinite spinner when $__all is selected and variable returns no options', async () => {
      const { rowToRepeat } = renderScene({ variableQueryTime: 0 }, []);

      await waitFor(() => {
        expect(rowToRepeat.state.repeatedRows).toBeDefined();
        expect(rowToRepeat.state.repeatedRows).toHaveLength(0);
      });
    });

    it('Should handle removing repeats', async () => {
      const { rowToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Row C')).toBeInTheDocument();
      });

      act(() => {
        rowToRepeat.onChangeRepeat(undefined);
      });

      expect(screen.queryByText('Row C')).not.toBeInTheDocument();
      expect(rowToRepeat.state.$variables).toBe(undefined);
      expect(rowToRepeat.state.repeatedRows).toBe(undefined);
      expect(rowToRepeat.state.repeatByVariable).toBe(undefined);
    });

    it('Should preserve section variable with duplicate name when removing repeats', () => {
      const sectionScopedVariable = new CustomVariable({
        name: 'server',
        query: 'row-scope',
        value: 'row-scope',
        text: 'row-scope',
      });
      const rowToRepeat = new RowItem({
        key: 'row-1',
        title: 'Row $server',
        repeatByVariable: 'server',
        $variables: new SceneVariableSet({
          variables: [new LocalValueVariable({ name: 'server', value: 'A1', text: 'A' }), sectionScopedVariable],
        }),
        layout: AutoGridLayoutManager.createEmpty(),
      });

      rowToRepeat.onChangeRepeat(undefined);

      expect(rowToRepeat.state.repeatedRows).toBeUndefined();
      expect(rowToRepeat.state.repeatByVariable).toBeUndefined();
      expect(rowToRepeat.state.$variables?.state.variables).toHaveLength(1);
      expect(rowToRepeat.state.$variables?.state.variables[0]).toBeInstanceOf(CustomVariable);
      expect(rowToRepeat.state.$variables?.state.variables[0].state.name).toBe('server');
      expect(rowToRepeat.state.$variables?.state.variables[0].getValue()).toBe('row-scope');
    });

    it('Should prefer section variable in repeated row content on name collision', async () => {
      const sectionScopedVariable = new CustomVariable({
        name: 'server',
        query: 'row-scope',
        value: 'row-scope',
        text: 'row-scope',
      });
      const rowVariables = new SceneVariableSet({ variables: [sectionScopedVariable] });

      const { rowToRepeat } = renderScene({ variableQueryTime: 0 }, undefined, undefined, rowVariables);

      await waitFor(() => {
        expect(screen.queryAllByText('Row row-scope')).toHaveLength(3);
      });

      const repeatedRows = [rowToRepeat, ...(rowToRepeat.state.repeatedRows ?? [])];
      expect(repeatedRows).toHaveLength(3);

      for (const row of repeatedRows) {
        const variables = row.state.$variables?.state.variables;
        expect(variables).toBeDefined();
        expect(variables![0]).toBeInstanceOf(CustomVariable);
        expect(variables![0].state.name).toBe('server');
        expect(variables![0].getValue()).toBe('row-scope');
      }
    });
  });

  describe('URL sync for delayed repeats', () => {
    it('hydrates source and clone section variable values from URL', () => {
      locationService.replace({
        search: 'var-section=blah&var-section-2=abc&var-section-3=de&var-section-4=moo',
      });

      const sectionVariable = new CustomVariable({
        name: 'section',
        query: 'default',
        value: 'default',
        text: 'default',
      });
      const repeatByVariable = new TestVariable({
        name: 'server',
        query: 'A.*',
        value: ['A1', 'B1', 'C1', 'D1'],
        text: ['A', 'B', 'C', 'D'],
        isMulti: true,
        includeAll: true,
        optionsToReturn: [
          { label: 'A', value: 'A1' },
          { label: 'B', value: 'B1' },
          { label: 'C', value: 'C1' },
          { label: 'D', value: 'D1' },
        ],
      });
      const row = new RowItem({
        key: 'row-1',
        title: 'Row',
        repeatByVariable: 'server',
        $variables: new SceneVariableSet({ variables: [sectionVariable] }),
        layout: AutoGridLayoutManager.createEmpty(),
      });
      const scene = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        $variables: new SceneVariableSet({ variables: [repeatByVariable] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });
      const urlSyncManager = new UrlSyncManager();

      // Simulate refresh order: URL sync is initialized before repeats are built.
      urlSyncManager.initSync(scene);
      performRowRepeats(repeatByVariable as unknown as MultiValueVariable, row, false);

      const repeatedRows = [row, ...(row.state.repeatedRows ?? [])];
      const sectionValues = repeatedRows.map((repeatedRow) => {
        const sectionVar = repeatedRow.state.$variables?.state.variables.find(
          (variable) => variable instanceof CustomVariable
        ) as CustomVariable;
        return sectionVar.getValue();
      });

      expect(sectionValues).toEqual(['blah', 'abc', 'de', 'moo']);
      expect(locationService.getLocation().search).toContain('var-section=blah');
    });
  });
});

interface SceneOptions {
  variableQueryTime: number;
  variableRefresh?: VariableRefresh;
}

function buildTextPanel(key: string, content: string) {
  const panel = PanelBuilders.text().setOption('content', content).setOption('mode', TextMode.Markdown).build();
  panel.setState({ key });
  return panel;
}

function renderScene(
  options: SceneOptions,
  variableOptions?: VariableValueOption[],
  variableStateOverrides?: { isMulti: boolean },
  rowVariables?: SceneVariableSet
) {
  const rows = [
    new RowItem({
      key: 'row-1',
      title: 'Row $server',
      repeatByVariable: 'server',
      $variables: rowVariables,
      layout: new AutoGridLayoutManager({
        layout: new AutoGridLayout({
          children: [
            new AutoGridItem({
              body: buildTextPanel('text-1', 'Panel inside repeated row, server = $server'),
            }),
          ],
        }),
      }),
    }),
  ];

  const layout = new RowsLayoutManager({ rows });
  const repeatByVariable = new TestVariable({
    name: 'server',
    query: 'A.*',
    value: ALL_VARIABLE_VALUE,
    text: ALL_VARIABLE_TEXT,
    isMulti: true,
    includeAll: true,
    delayMs: options.variableQueryTime,
    refresh: options.variableRefresh,
    optionsToReturn: variableOptions ?? [
      { label: 'A', value: 'A1' },
      { label: 'B', value: 'B1' },
      { label: 'C', value: 'C1' },
    ],
    ...variableStateOverrides,
  });

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [repeatByVariable],
    }),
    body: layout,
  });

  const rowToRepeat = rows[0];

  render(<scene.Component model={scene} />);

  return { scene, layout, rows, rowToRepeat, repeatByVariable };
}
