import { act, render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { activateFullSceneTree } from '../../../utils/test-utils';
import { DashboardScene } from '../../DashboardScene';
import { RowItem } from '../../layout-rows/RowItem';
import { RowsLayoutManager } from '../../layout-rows/RowsLayoutManager';
import { TabItem } from '../../layout-tabs/TabItem';
import { TabsLayoutManager } from '../../layout-tabs/TabsLayoutManager';

import { ListItemMoveActions } from './ListItemMoveActions';
import { canMoveListItem, moveListItem } from './moveListItem';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

let deactivate: (() => void) | undefined;

beforeEach(() => setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: true }));

afterEach(() => {
  setTestFlags({});
  deactivate?.();
  deactivate = undefined;
});

function setupRows() {
  const rows = ['Row A', 'Row B', 'Row C'].map((title) => new RowItem({ title }));
  const layout = new RowsLayoutManager({ rows });
  const dashboard = new DashboardScene({ isEditing: true, body: layout });
  deactivate = activateFullSceneTree(dashboard);
  return { layout, rows, sidebar: dashboard.state.sidebar };
}

function setupTabs() {
  const tabs = ['Tab A', 'Tab B', 'Tab C'].map((title) => new TabItem({ title }));
  const layout = new TabsLayoutManager({ tabs });
  const dashboard = new DashboardScene({ isEditing: true, body: layout });
  deactivate = activateFullSceneTree(dashboard);
  return { layout, tabs, sidebar: dashboard.state.sidebar };
}

const rowTitles = (layout: RowsLayoutManager) => layout.state.rows.map((row) => row.state.title);
const tabTitles = (layout: TabsLayoutManager) => layout.state.tabs.map((tab) => tab.state.title);

describe('moveListItem', () => {
  it('moves a row down and up one place, each as one undoable action', () => {
    const { layout, rows, sidebar } = setupRows();

    moveListItem(rows[0], 'next');
    expect(rowTitles(layout)).toEqual(['Row B', 'Row A', 'Row C']);
    moveListItem(rows[2], 'previous');
    expect(rowTitles(layout)).toEqual(['Row B', 'Row C', 'Row A']);
    expect(sidebar.state.undoStack).toHaveLength(2);

    sidebar.undoAction();
    expect(rowTitles(layout)).toEqual(['Row B', 'Row A', 'Row C']);
    sidebar.undoAction();
    expect(rowTitles(layout)).toEqual(['Row A', 'Row B', 'Row C']);
    sidebar.redoAction();
    sidebar.redoAction();
    expect(rowTitles(layout)).toEqual(['Row B', 'Row C', 'Row A']);
  });

  it('moves a tab right and left one place, undoably', () => {
    const { layout, tabs, sidebar } = setupTabs();

    moveListItem(tabs[1], 'next');
    expect(tabTitles(layout)).toEqual(['Tab A', 'Tab C', 'Tab B']);
    moveListItem(tabs[1], 'previous');
    moveListItem(tabs[1], 'previous');
    expect(tabTitles(layout)).toEqual(['Tab B', 'Tab A', 'Tab C']);

    sidebar.undoAction();
    expect(tabTitles(layout)).toEqual(['Tab A', 'Tab B', 'Tab C']);
    sidebar.redoAction();
    expect(tabTitles(layout)).toEqual(['Tab B', 'Tab A', 'Tab C']);
  });

  it('does nothing past either end of the list', () => {
    const { layout, rows, sidebar } = setupRows();

    expect(canMoveListItem(rows[0], 'previous')).toBe(false);
    expect(canMoveListItem(rows[2], 'next')).toBe(false);
    expect(canMoveListItem(rows[1], 'previous')).toBe(true);
    expect(canMoveListItem(rows[1], 'next')).toBe(true);

    moveListItem(rows[0], 'previous');
    moveListItem(rows[2], 'next');
    expect(rowTitles(layout)).toEqual(['Row A', 'Row B', 'Row C']);
    expect(sidebar.state.undoStack).toHaveLength(0);
  });
});

describe('ListItemMoveActions', () => {
  it('moves the row with the Move up and Move down buttons, which are disabled at the ends', async () => {
    const { layout, rows } = setupRows();
    const { user } = render(<ListItemMoveActions item={rows[0]} />);

    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move down' }));
    expect(rowTitles(layout)).toEqual(['Row B', 'Row A', 'Row C']);
    expect(screen.getByRole('button', { name: 'Move up' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Move down' }));
    expect(rowTitles(layout)).toEqual(['Row B', 'Row C', 'Row A']);
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled();
  });

  it('updates the disabled state when the order changes elsewhere, e.g. on undo', async () => {
    const { rows, sidebar } = setupRows();
    const { user } = render(<ListItemMoveActions item={rows[0]} />);
    await user.click(screen.getByRole('button', { name: 'Move down' }));

    await act(async () => sidebar.undoAction());

    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
  });

  it('uses left and right for tabs', async () => {
    const { layout, tabs } = setupTabs();
    const { user } = render(<ListItemMoveActions item={tabs[2]} />);

    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move left' }));

    expect(tabTitles(layout)).toEqual(['Tab A', 'Tab C', 'Tab B']);
  });

  it('is not shown with the unified drag and drop flag off', () => {
    setTestFlags({ [FlagKeys.GrafanaDashboardUnifiedDragAndDrop]: false });
    const { rows } = setupRows();

    const { container } = render(<ListItemMoveActions item={rows[1]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
