import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { GRID_CELL_VMARGIN } from 'app/core/constants';

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
  {
    name: 'max columns',
    change: (m: AutoGridLayoutManager) => changeAutoGridMaxColumnCount(m, 2),
    expectedChanges: {
      maxColumnCount: 2,
      templateColumns: `repeat(auto-fit, minmax(min(max(100% / 2 - ${GRID_CELL_VMARGIN}px, 448px), 100%), 1fr))`,
    },
  },
  {
    name: 'custom column width',
    change: (m: AutoGridLayoutManager) => changeAutoGridColumnWidth(m, 'custom'),
    expectedChanges: { columnWidth: 448 },
  },
  {
    name: 'custom row height',
    change: (m: AutoGridLayoutManager) => changeAutoGridRowHeight(m, 'custom'),
    expectedChanges: { rowHeight: 320 },
  },
  {
    name: 'fill screen',
    change: (m: AutoGridLayoutManager) => changeAutoGridFillScreen(m, true),
    expectedChanges: {
      fillScreen: true,
      fitContent: false,
      autoRows: 'minmax(320px, auto)',
    },
  },
  {
    name: 'fit content',
    change: (m: AutoGridLayoutManager) => changeAutoGridFitContent(m, true),
    expectedChanges: {
      fitContent: true,
      fillScreen: false,
      autoRows: 'minmax(320px, max-content)',
    },
  },
  {
    name: 'min height',
    change: (m: AutoGridLayoutManager) => changeAutoGridMinHeight(m, 'none'),
    expectedChanges: { minHeight: 'none' },
  },
  {
    name: 'max height mode',
    change: (m: AutoGridLayoutManager) => changeAutoGridMaxHeightMode(m, 'custom'),
    expectedChanges: {
      maxHeightMode: 'custom',
      maxHeight: 320,
    },
  },
  {
    name: 'custom max height',
    change: (m: AutoGridLayoutManager) => changeAutoGridMaxHeightCustom(m, 400),
    expectedChanges: {
      maxHeightMode: 'custom',
      maxHeight: 400,
    },
  },
  {
    name: 'match row heights',
    change: (m: AutoGridLayoutManager) => changeAutoGridMatchRowHeights(m, false),
    expectedChanges: { matchRowHeights: false },
  },
])('changes $name as one undoable action', ({ change, expectedChanges }) => {
  const manager = new AutoGridLayoutManager({});
  const dashboard = new DashboardScene({ isEditing: true, body: manager });
  const deactivate = activateFullSceneTree(dashboard);
  const sidebar = dashboard.state.sidebar;
  const before = getOptionsState(manager);
  const expected = { ...before, ...expectedChanges };

  try {
    change(manager);

    expect(getOptionsState(manager)).toEqual(expected);
    expect(sidebar.state.undoStack).toHaveLength(1);

    sidebar.undoAction();
    expect(getOptionsState(manager)).toEqual(before);

    sidebar.redoAction();
    expect(getOptionsState(manager)).toEqual(expected);
  } finally {
    deactivate();
  }
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
