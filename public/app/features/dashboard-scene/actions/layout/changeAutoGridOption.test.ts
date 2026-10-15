import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import {
  changeAutoGridColumnWidth,
  changeAutoGridFillScreen,
  changeAutoGridFitContent,
  changeAutoGridMatchRowHeights,
  changeAutoGridMaxColumnCount,
  changeAutoGridMaxHeightCustom,
  changeAutoGridMaxHeightMode,
  changeAutoGridMinHeight,
  changeAutoGridRowHeight,
} from './changeAutoGridOption';

function getOptionsState(manager: AutoGridLayoutManager) {
  const { layout, isDropTarget, dropPosition, key, ...options } = manager.state;
  const { templateColumns, autoRows } = layout.state;

  return { ...options, templateColumns, autoRows };
}

beforeEach(() => {
  setTestFlags({ [FlagKeys.GrafanaDashboardsAutoHeightPanels]: true });
});

it.each([
  { name: 'max columns', change: (m: AutoGridLayoutManager) => changeAutoGridMaxColumnCount(m, 2) },
  { name: 'custom column width', change: (m: AutoGridLayoutManager) => changeAutoGridColumnWidth(m, 'custom') },
  { name: 'custom row height', change: (m: AutoGridLayoutManager) => changeAutoGridRowHeight(m, 'custom') },
  { name: 'fill screen', change: (m: AutoGridLayoutManager) => changeAutoGridFillScreen(m, true) },
  { name: 'fit content', change: (m: AutoGridLayoutManager) => changeAutoGridFitContent(m, true) },
  { name: 'min height', change: (m: AutoGridLayoutManager) => changeAutoGridMinHeight(m, 'none') },
  { name: 'max height mode', change: (m: AutoGridLayoutManager) => changeAutoGridMaxHeightMode(m, 'custom') },
  { name: 'custom max height', change: (m: AutoGridLayoutManager) => changeAutoGridMaxHeightCustom(m, 400) },
  { name: 'match row heights', change: (m: AutoGridLayoutManager) => changeAutoGridMatchRowHeights(m, false) },
])('changes $name as one undoable action', ({ change }) => {
  const manager = new AutoGridLayoutManager({});
  const dashboard = new DashboardScene({ isEditing: true, body: manager });
  const deactivate = activateFullSceneTree(dashboard);
  const sidebar = dashboard.state.sidebar;
  const before = getOptionsState(manager);

  change(manager);
  const after = getOptionsState(manager);
  expect(after).not.toEqual(before);
  expect(sidebar.state.undoStack).toHaveLength(1);

  sidebar.undoAction();
  expect(getOptionsState(manager)).toEqual(before);

  sidebar.redoAction();
  expect(getOptionsState(manager)).toEqual(after);

  deactivate();
});

it('restores fit content when undoing fill screen', () => {
  const manager = new AutoGridLayoutManager({ fillScreen: false, fitContent: true });
  const dashboard = new DashboardScene({ isEditing: true, body: manager });
  const deactivate = activateFullSceneTree(dashboard);

  changeAutoGridFillScreen(manager, true);
  expect(manager.state.fitContent).toBe(false);

  dashboard.state.sidebar.undoAction();
  expect(manager.state).toMatchObject({ fillScreen: false, fitContent: true });

  deactivate();
});
