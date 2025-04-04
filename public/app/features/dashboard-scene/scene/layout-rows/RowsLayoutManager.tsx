import { SceneGridItemLike, SceneGridRow, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { t } from 'app/core/internationalization';

import {
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
} from '../../edit-pane/shared';
import { serializeRowsLayout } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { isClonedKey } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../layout-default/RowRepeaterBehavior';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { getRowFromClipboard } from '../layouts-shared/paste';
import { generateUniqueTitle, ungroupLayout } from '../layouts-shared/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { RowItem } from './RowItem';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
import { RowLayoutManagerRenderer } from './RowsLayoutManagerRenderer';

interface RowsLayoutManagerState extends SceneObjectState {
  rows: RowItem[];
}

export class RowsLayoutManager extends SceneObjectBase<RowsLayoutManagerState> implements DashboardLayoutManager {
  public static Component = RowLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.rows-layout.name', 'Rows');
    },
    get description() {
      return t('dashboard.rows-layout.description', 'Collapsable panel groups with headings');
    },
    id: 'RowsLayout',
    createFromLayout: RowsLayoutManager.createFromLayout,
    isGridLayout: false,
  };

  public serialize(): DashboardV2Spec['layout'] {
    return serializeRowsLayout(this);
  }

  public readonly descriptor = RowsLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {
    // Try to add new panels to the selected row
    const selectedRows = dashboardSceneGraph.getAllSelectedObjects(this).filter((obj) => obj instanceof RowItem);
    if (selectedRows.length > 0) {
      return selectedRows.forEach((row) => row.onAddPanel(vizPanel));
    }

    // If we don't have selected row add it to the first row
    if (this.state.rows.length > 0) {
      return this.state.rows[0].onAddPanel(vizPanel);
    }

    // Otherwise fallback to adding a new row and a panel
    this.addNewRow();
    this.state.rows[this.state.rows.length - 1].onAddPanel(vizPanel);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const row of this.state.rows) {
      const innerPanels = row.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    throw new Error('Method not implemented.');
  }

  public duplicate(): DashboardLayoutManager {
    const newRows = this.state.rows.map((row) => row.duplicate());
    return this.clone({ rows: newRows, key: undefined });
  }

  public duplicateRow(row: RowItem) {
    const newRow = row.duplicate();
    this.addNewRow(newRow);
  }

  public addNewRow(row?: RowItem): RowItem {
    const newRow = row ?? new RowItem({ isNew: true });
    const existingNames = new Set(this.state.rows.map((row) => row.state.title).filter((title) => title !== undefined));

    const newTitle = generateUniqueTitle(newRow.state.title, existingNames);
    if (newTitle !== newRow.state.title) {
      newRow.setState({ title: newTitle });
    }

    this.setState({ rows: [...this.state.rows, newRow] });
    this.publishEvent(new NewObjectAddedToCanvasEvent(newRow), true);
    return newRow;
  }

  public editModeChanged(isEditing: boolean) {
    this.state.rows.forEach((row) => row.getLayout().editModeChanged?.(isEditing));
  }

  public pasteRow() {
    const scene = getDashboardSceneFor(this);
    const row = getRowFromClipboard(scene);
    this.addNewRow(row);
  }

  public activateRepeaters() {
    this.state.rows.forEach((row) => {
      if (!row.isActive) {
        row.activate();
      }

      const behavior = (row.state.$behaviors ?? []).find((b) => b instanceof RowItemRepeaterBehavior);

      if (!behavior?.isActive) {
        behavior?.activate();
      }

      row.getLayout().activateRepeaters?.();
    });
  }

  public removeRow(row: RowItem) {
    // When removing last row replace ourselves with the inner row layout
    if (this.state.rows.length === 1) {
      ungroupLayout(this, row.state.layout);
      return;
    }

    const rows = this.state.rows.filter((r) => r !== row);
    this.setState({ rows });
    this.publishEvent(new ObjectRemovedFromCanvasEvent(row), true);
  }

  public moveRow(_rowKey: string, fromIndex: number, toIndex: number) {
    const rows = [...this.state.rows];
    const [removed] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, removed);
    this.setState({ rows });
    this.publishEvent(new ObjectsReorderedOnCanvasEvent(this), true);
  }

  public forceSelectRow(rowKey: string) {
    const rowIndex = this.state.rows.findIndex((row) => row.state.key === rowKey);
    const row = this.state.rows[rowIndex];

    if (!row) {
      return;
    }

    const editPane = getDashboardSceneFor(this).state.editPane;
    editPane.selectObject(row!, rowKey, { force: true, multi: false });
  }

  public static createEmpty(): RowsLayoutManager {
    return new RowsLayoutManager({ rows: [new RowItem()] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): RowsLayoutManager {
    let rows: RowItem[] = [];

    if (layout instanceof TabsLayoutManager) {
      for (const tab of layout.state.tabs) {
        rows.push(new RowItem({ layout: tab.state.layout.clone(), title: tab.state.title }));
      }
    } else if (layout instanceof DefaultGridLayoutManager) {
      const config: Array<{
        title?: string;
        isCollapsed?: boolean;
        isDraggable?: boolean;
        isResizable?: boolean;
        children: SceneGridItemLike[];
        repeat?: string;
      }> = [];
      let children: SceneGridItemLike[] | undefined;

      layout.state.grid.forEachChild((child) => {
        if (!(child instanceof DashboardGridItem) && !(child instanceof SceneGridRow)) {
          throw new Error('Child is not a DashboardGridItem or SceneGridRow, invalid scene');
        }

        if (child instanceof SceneGridRow) {
          if (!isClonedKey(child.state.key!)) {
            const behaviour = child.state.$behaviors?.find((b) => b instanceof RowRepeaterBehavior);

            config.push({
              title: child.state.title,
              isCollapsed: !!child.state.isCollapsed,
              isDraggable: child.state.isDraggable,
              isResizable: child.state.isResizable,
              children: child.state.children,
              repeat: behaviour?.state.variableName,
            });

            // Since we encountered a row item, any subsequent panels should be added to a new row
            children = undefined;
          }
        } else {
          if (!children) {
            children = [];
            config.push({ children });
          }

          children.push(child);
        }
      });

      rows = config.map(
        (rowConfig) =>
          new RowItem({
            title: rowConfig.title,
            collapse: !!rowConfig.isCollapsed,
            layout: DefaultGridLayoutManager.fromGridItems(
              rowConfig.children,
              rowConfig.isDraggable ?? layout.state.grid.state.isDraggable,
              rowConfig.isResizable ?? layout.state.grid.state.isResizable
            ),
            $behaviors: rowConfig.repeat ? [new RowItemRepeaterBehavior({ variableName: rowConfig.repeat })] : [],
          })
      );
    } else {
      rows = [new RowItem({ layout: layout.clone() })];
    }

    // Ensure we always get at least one row
    if (rows.length === 0) {
      rows = [new RowItem()];
    }

    return new RowsLayoutManager({ rows });
  }

  public duplicateTitles(): Set<string | undefined> {
    const titleCounts = new Map<string | undefined, number>();
    const duplicateTitles = new Set<string | undefined>();

    this.state.rows.forEach((row) => {
      const title = row.state.title;
      const count = (titleCounts.get(title) ?? 0) + 1;
      titleCounts.set(title, count);
      if (count > 1 && title) {
        duplicateTitles.add(title);
      }
    });

    return duplicateTitles;
  }
}
