import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneGridItemLike,
  SceneGridRow,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { isClonedKey } from '../../utils/clone';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../layout-default/RowRepeaterBehavior';
import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { RowItem } from './RowItem';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';

interface RowsLayoutManagerState extends SceneObjectState {
  rows: RowItem[];
}

export class RowsLayoutManager extends SceneObjectBase<RowsLayoutManagerState> implements DashboardLayoutManager {
  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor = {
    get name() {
      return t('dashboard.rows-layout.name', 'Rows');
    },
    get description() {
      return t('dashboard.rows-layout.description', 'Rows layout');
    },
    id: 'rows-layout',
    createFromLayout: RowsLayoutManager.createFromLayout,
  };

  public readonly descriptor = RowsLayoutManager.descriptor;

  public editModeChanged(isEditing: boolean): void {}

  public addPanel(vizPanel: VizPanel): void {
    // Try to add new panels to the selected row
    const selectedObject = this.getSelectedObject();
    if (selectedObject instanceof RowItem) {
      return selectedObject.onAddPanel(vizPanel);
    }

    // If we don't have selected row add it to the first row
    if (this.state.rows.length > 0) {
      return this.state.rows[0].onAddPanel(vizPanel);
    }

    // Otherwise fallback to adding a new row and a panel
    this.addNewRow();
    this.state.rows[this.state.rows.length - 1].onAddPanel(vizPanel);
  }

  public addNewRow(): void {
    this.setState({
      rows: [
        ...this.state.rows,
        new RowItem({
          title: t('dashboard.rows-layout.row.new', 'New row'),
          layout: ResponsiveGridLayoutManager.createEmpty(),
        }),
      ],
    });
  }

  public getMaxPanelId(): number {
    return Math.max(...this.state.rows.map((row) => row.getLayout().getMaxPanelId()));
  }

  public getNextPanelId(): number {
    return 0;
  }

  public removePanel(panel: VizPanel) {}

  public removeRow(row: RowItem) {
    this.setState({
      rows: this.state.rows.filter((r) => r !== row),
    });
  }

  public duplicatePanel(panel: VizPanel): void {
    throw new Error('Method not implemented.');
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const row of this.state.rows) {
      const innerPanels = row.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public getOptions() {
    return [];
  }

  public activateRepeaters() {
    this.state.rows.forEach((row) => {
      if (row.state.$behaviors) {
        for (const behavior of row.state.$behaviors) {
          if (behavior instanceof RowItemRepeaterBehavior && !row.isActive) {
            row.activate();
            break;
          }
        }

        if (!row.getLayout().isActive) {
          row.getLayout().activate();
        }
      }
    });
  }

  public getSelectedObject() {
    return sceneGraph.getAncestor(this, DashboardScene).state.editPane.state.selection?.getFirstObject();
  }

  public static createEmpty() {
    return new RowsLayoutManager({ rows: [] });
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
            title: rowConfig.title ?? t('dashboard.rows-layout.row.new', 'New row'),
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
      rows = [new RowItem({ layout: layout.clone(), title: t('dashboard.rows-layout.row.new', 'New row') })];
    }

    return new RowsLayoutManager({ rows });
  }

  public static Component = ({ model }: SceneComponentProps<RowsLayoutManager>) => {
    const { rows } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.wrapper}>
        {rows.map((row) => (
          <row.Component model={row} key={row.state.key!} />
        ))}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flexGrow: 1,
      width: '100%',
    }),
  };
}
