import { store } from '@grafana/data';
import { SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { LS_ROW_COPY_KEY, LS_TAB_COPY_KEY } from 'app/core/constants';

import { getQueryRunnerFor } from '../utils/getQueryRunnerFor';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';
import { clearClipboard } from './layouts-shared/paste';
import { type DashboardPlanningState } from './types/dashboard';

jest.mock('../actions/element/addElement', () => ({
  addElement: ({ perform }: { perform: () => void }) => perform(),
}));

const planning: DashboardPlanningState = {
  planId: 'plan-1',
  planTitle: 'Preview',
  panelCount: 1,
  onBuild: jest.fn(),
  onDismiss: jest.fn(),
};

function setup(kind: 'row' | 'tab') {
  const panel = new VizPanel({
    key: 'panel-1',
    title: 'Request rate',
    pluginId: 'timeseries',
    $data: new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' }),
  });
  const grid = new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) });
  grid.addPanel(panel);
  const section = kind === 'row' ? new RowItem({ layout: grid }) : new TabItem({ layout: grid });
  const layout =
    section instanceof RowItem
      ? new RowsLayoutManager({ rows: [section] })
      : new TabsLayoutManager({ tabs: [section] });
  const scene = new DashboardScene({ title: 'Source', meta: {}, body: layout, isEditing: true });
  const paste = () => (layout instanceof RowsLayoutManager ? layout.pasteRow() : layout.pasteTab());
  return { section, scene, layout, paste, key: kind === 'row' ? LS_ROW_COPY_KEY : LS_TAB_COPY_KEY };
}

afterEach(clearClipboard);

it.each(['row', 'tab'] as const)('prevents a planned %s from replacing the clipboard', (kind) => {
  const { section, scene, key } = setup(kind);
  store.set(key, 'previous clipboard');
  scene.setState({ planning });

  section.onCopy();

  expect(section.isCopyAllowed()).toBe(false);
  expect(store.get(key)).toBe('previous clipboard');
});

it.each(['row', 'tab'] as const)('blocks pasting a real %s while planning and allows it afterwards', (kind) => {
  const { section, scene, layout, paste, key } = setup(kind);
  section.onCopy();
  const clipboard = store.get(key);
  scene.setState({ planning });

  paste();

  expect(layout.getVizPanels().map((panel) => panel.state.title)).toEqual(['Request rate']);
  expect(store.get(key)).toBe(clipboard);

  scene.setState({ planning: undefined });
  paste();

  expect(layout.getVizPanels().map((panel) => panel.state.title)).toEqual(['Request rate', 'Request rate']);
  expect(getQueryRunnerFor(layout.getVizPanels()[1])?.state.queries).toEqual([{ refId: 'A', hide: false }]);
});
