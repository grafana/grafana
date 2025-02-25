import { SceneGridItemLike, SceneGridRow, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { isClonedKey } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../layout-default/RowRepeaterBehavior';
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
      return t('dashboard.rows-layout.description', 'Rows layout');
    },
    id: 'rows-layout',
    createFromLayout: RowsLayoutManager.createFromLayout,

    kind: 'RowsLayout',
  };

  public readonly descriptor = RowsLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {
    // Try to add new panels to the selected row
    const selectedRows = dashboardSceneGraph.getAllSelectedObjects(this).filter((obj) => obj instanceof RowItem);
    if (selectedRows.length > 0) {
      return selectedRows.forEach((row) => row.getLayout().addPanel(vizPanel));
    }

    // If we don't have selected row add it to the first row
    if (this.state.rows.length > 0) {
      return this.state.rows[0].getLayout().addPanel(vizPanel);
    }

    // Otherwise fallback to adding a new row and a panel
    this.addNewRow();
    this.state.rows[this.state.rows.length - 1].getLayout().addPanel(vizPanel);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const row of this.state.rows) {
      const innerPanels = row.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public hasVizPanels(): boolean {
    for (const row of this.state.rows) {
      if (row.getLayout().hasVizPanels()) {
        return true;
      }
    }

    return false;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    throw new Error('Method not implemented.');
  }

  public addNewRow() {
    this.setState({ rows: [...this.state.rows, new RowItem()] });
  }

  public editModeChanged(isEditing: boolean) {
    this.state.rows.forEach((row) => row.getLayout().editModeChanged?.(isEditing));
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
    const rows = this.state.rows.filter((r) => r !== row);
    this.setState({ rows: rows.length === 0 ? [new RowItem()] : rows });
  }

  public static createEmpty(): RowsLayoutManager {
    return new RowsLayoutManager({ rows: [new RowItem()] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): RowsLayoutManager {
    let rows: RowItem[];

    if (layout instanceof DefaultGridLayoutManager) {
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
              isDraggable: child.state.isDraggable ?? layout.state.grid.state.isDraggable,
              isResizable: child.state.isResizable ?? layout.state.grid.state.isResizable,
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
            isCollapsed: !!rowConfig.isCollapsed,
            layout: DefaultGridLayoutManager.fromGridItems(
              rowConfig.children,
              rowConfig.isDraggable,
              rowConfig.isResizable
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
}
