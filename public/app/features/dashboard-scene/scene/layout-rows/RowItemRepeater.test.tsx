import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, SceneVariableSet, TestVariable, VariableValueOption, PanelBuilders } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { getCloneKey, joinCloneKeys } from '../../utils/clone';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { RowItem } from './RowItem';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
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
  describe('Given scene with variable with 3 values', () => {
    it('Should repeat row', async () => {
      const { rowToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Row A')).toBeInTheDocument();
        expect(screen.queryByText('Row B')).toBeInTheDocument();
        expect(screen.queryByText('Row C')).toBeInTheDocument();
      });

      expect(rowToRepeat.state.repeatedRows!.length).toBe(2);
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
  variableStateOverrides?: { isMulti: boolean }
) {
  const rows = [
    new RowItem({
      key: 'row-1',
      title: 'Row $server',
      repeatByVariable: 'server',
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

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
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
        }),
      ],
    }),
    body: layout,
  });

  const rowToRepeat = rows[0];

  render(<scene.Component model={scene} />);

  return { scene, layout, rows, rowToRepeat };
}

function getRowLayout(row: RowItem): DefaultGridLayoutManager {
  const layout = row.getLayout();

  if (!(layout instanceof DefaultGridLayoutManager)) {
    throw new Error('Invalid layout');
  }

  return layout;
}

function getRowChildren(row: RowItem): DashboardGridItem[] {
  const layout = getRowLayout(row);

  const filteredChildren = layout.state.grid.state.children.filter((child) => child instanceof DashboardGridItem);

  if (filteredChildren.length !== layout.state.grid.state.children.length) {
    throw new Error('Invalid layout');
  }

  return filteredChildren;
}
