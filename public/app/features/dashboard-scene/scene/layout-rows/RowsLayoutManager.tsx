import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneGridItemLike,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { Modal, Button } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { ShowConfirmModalEvent, ShowModalReactEvent } from 'app/types/events';

import { dashboardEditActions, ObjectsReorderedOnCanvasEvent } from '../../edit-pane/shared';
import { serializeRowsLayout } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { getDashboardSceneFor } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../layout-default/RowRepeaterBehavior';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { findAllGridTypes } from '../layouts-shared/findAllGridTypes';
import { layoutRegistry } from '../layouts-shared/layoutRegistry';
import { getRowFromClipboard } from '../layouts-shared/paste';
import { generateUniqueTitle, ungroupLayout } from '../layouts-shared/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { RowItem } from './RowItem';
import { RowLayoutManagerRenderer } from './RowsLayoutManagerRenderer';

interface RowsLayoutManagerState extends SceneObjectState {
  rows: RowItem[];
}

enum GridLayoutType {
  AutoGridLayout = 'AutoGridLayout',
  GridLayout = 'GridLayout',
}

function mapIdToGridLayoutType(id?: string): GridLayoutType | undefined {
  switch (id) {
    case GridLayoutType.AutoGridLayout:
      return GridLayoutType.AutoGridLayout;
    case GridLayoutType.GridLayout:
      return GridLayoutType.GridLayout;
    default:
      return undefined;
  }
}

function ConvertMixedGridsModal({
  availableIds,
  onSelect,
  onDismiss,
}: {
  availableIds: Set<string>;
  onSelect: (id: string) => void;
  onDismiss: () => void;
}) {
  const options = layoutRegistry.list(Array.from(availableIds));

  return (
    <Modal
      isOpen={true}
      title={t('dashboard.rows-layout.ungroup-convert-title', 'Convert mixed grids?')}
      onDismiss={onDismiss}
    >
      <p>
        {t(
          'dashboard.rows-layout.ungroup-convert-text',
          'All grids must be converted to the same type and positions will be lost.'
        )}
      </p>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          {t('dashboard.rows-layout.cancel', 'Cancel')}
        </Button>
        {options.map((opt) => (
          <Button
            icon={opt.icon}
            key={opt.id}
            variant="primary"
            onClick={() => {
              onSelect(opt.id);
              onDismiss();
            }}
          >
            {t('dashboard.rows-layout.convert-to', 'Convert to {{name}}', { name: opt.name })}
          </Button>
        ))}
      </Modal.ButtonRow>
    </Modal>
  );
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
    icon: 'list-ul',
  };

  public serialize(): DashboardV2Spec['layout'] {
    return serializeRowsLayout(this);
  }

  public readonly descriptor = RowsLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {}

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const row of this.state.rows) {
      const innerPanels = row.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({});
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
    const newRow = row ?? new RowItem({});
    const existingNames = new Set(this.state.rows.map((row) => row.state.title).filter((title) => title !== undefined));

    const newTitle = generateUniqueTitle(newRow.state.title, existingNames);
    if (newTitle !== newRow.state.title) {
      newRow.setState({ title: newTitle });
    }

    dashboardEditActions.addElement({
      addedObject: newRow,
      source: this,
      perform: () => this.setState({ rows: [...this.state.rows, newRow] }),
      undo: () => this.setState({ rows: this.state.rows.filter((r) => r !== newRow) }),
    });

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

  public shouldUngroup(): boolean {
    return this.state.rows.length === 1;
  }

  public getOutlineChildren() {
    const outlineChildren: SceneObject[] = [];

    for (const row of this.state.rows) {
      outlineChildren.push(row);

      if (row.state.repeatedRows) {
        for (const clone of row.state.repeatedRows!) {
          outlineChildren.push(clone);
        }
      }
    }

    return outlineChildren;
  }

  public merge(other: DashboardLayoutManager) {
    throw new Error('Not implemented');
  }

  public convertAllRowsLayouts(gridLayoutType: GridLayoutType) {
    for (const row of this.state.rows) {
      switch (gridLayoutType) {
        case GridLayoutType.AutoGridLayout:
          if (!(row.getLayout() instanceof AutoGridLayoutManager)) {
            row.switchLayout(AutoGridLayoutManager.createFromLayout(row.getLayout()));
          }
          break;
        case GridLayoutType.GridLayout:
          if (!(row.getLayout() instanceof DefaultGridLayoutManager)) {
            row.switchLayout(DefaultGridLayoutManager.createFromLayout(row.getLayout()));
          }
          break;
      }
    }
  }

  public ungroupRows() {
    const hasNonGridLayout = this.state.rows.some((row) => !row.getLayout().descriptor.isGridLayout);
    const gridTypes = new Set(findAllGridTypes(this));

    if (hasNonGridLayout) {
      appEvents.publish(
        new ShowConfirmModalEvent({
          title: t('dashboard.rows-layout.ungroup-nested-title', 'Ungroup nested groups?'),
          text: t('dashboard.rows-layout.ungroup-nested-text', 'This will ungroup all nested groups.'),
          yesText: t('dashboard.rows-layout.continue', 'Continue'),
          noText: t('dashboard.rows-layout.cancel', 'Cancel'),
          onConfirm: () => {
            if (gridTypes.size > 1) {
              requestAnimationFrame(() => {
                this._confirmConvertMixedGrids(gridTypes);
              });
            } else {
              this.wrapUngroupRowsInEdit(mapIdToGridLayoutType(gridTypes.values().next().value)!);
            }
          },
        })
      );
      return;
    }

    if (gridTypes.size > 1) {
      this._confirmConvertMixedGrids(gridTypes);
      return;
    } else {
      this.wrapUngroupRowsInEdit(mapIdToGridLayoutType(gridTypes.values().next().value)!);
    }
  }

  private _confirmConvertMixedGrids(availableIds: Set<string>) {
    appEvents.publish(
      new ShowModalReactEvent({
        component: ConvertMixedGridsModal,
        props: {
          availableIds,
          onSelect: (id: string) => {
            const selected = mapIdToGridLayoutType(id);
            if (selected) {
              this.wrapUngroupRowsInEdit(selected);
            }
          },
        },
      })
    );
  }

  private wrapUngroupRowsInEdit(gridLayoutType: GridLayoutType) {
    const parent = this.parent;
    if (!parent || !isLayoutParent(parent)) {
      throw new Error('Ungroup rows failed: parent is not a layout container');
    }

    const previousLayout = this.clone({});
    const scene = getDashboardSceneFor(this);

    dashboardEditActions.edit({
      description: t('dashboard.rows-layout.edit.ungroup-rows', 'Ungroup rows'),
      source: scene,
      perform: () => {
        this._ungroupRows(gridLayoutType);
      },
      undo: () => {
        parent.switchLayout(previousLayout);
      },
    });
  }

  private _ungroupRows(gridLayoutType: GridLayoutType) {
    const hasNonGridLayout = this.state.rows.some((row) => !row.getLayout().descriptor.isGridLayout);

    if (hasNonGridLayout) {
      for (const row of this.state.rows) {
        const layout = row.getLayout();
        if (!layout.descriptor.isGridLayout) {
          if (layout instanceof RowsLayoutManager) {
            layout._ungroupRows(gridLayoutType);
          } else {
            throw new Error('Not implemented');
          }
        }
      }
    }

    this.convertAllRowsLayouts(gridLayoutType);

    const firstRow = this.state.rows[0];
    const firstRowLayout = firstRow.getLayout();
    const otherRows = this.state.rows.slice(1);

    for (const row of otherRows) {
      firstRowLayout.merge(row.getLayout());
    }

    this.setState({ rows: [firstRow] });
    this.removeRow(firstRow, true);
  }

  public removeRow(row: RowItem, skipUndo?: boolean) {
    // When removing last row replace ourselves with the inner row layout
    if (this.shouldUngroup()) {
      ungroupLayout(this, row.state.layout, skipUndo);
      return;
    }

    const indexOfRowToRemove = this.state.rows.findIndex((r) => r === row);

    const perform = () => this.setState({ rows: this.state.rows.filter((r) => r !== row) });
    const undo = () => {
      const rows = [...this.state.rows];
      rows.splice(indexOfRowToRemove, 0, row);
      this.setState({ rows });
    };

    if (skipUndo) {
      perform();
    } else {
      dashboardEditActions.removeElement({
        removedObject: row,
        source: this,
        perform,
        undo,
      });
    }
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
        if (tab.state.repeatSourceKey) {
          continue;
        }

        const conditionalRendering = tab.state.conditionalRendering;
        conditionalRendering?.clearParent();

        rows.push(
          new RowItem({
            layout: tab.state.layout.clone(),
            title: tab.state.title,
            conditionalRendering,
            repeatByVariable: tab.state.repeatByVariable,
          })
        );
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
          // Skip repeated row clones
          if (child.state.repeatSourceKey) {
            return;
          }

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
            repeatByVariable: rowConfig.repeat,
            layout: DefaultGridLayoutManager.fromGridItems(
              rowConfig.children,
              rowConfig.isDraggable ?? layout.state.grid.state.isDraggable,
              rowConfig.isResizable ?? layout.state.grid.state.isResizable,
              layout.state.grid.state.isLazy
            ),
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
      const title = sceneGraph.interpolate(row, row.state.title);
      const count = (titleCounts.get(title) ?? 0) + 1;
      titleCounts.set(title, count);
      if (count > 1 && title) {
        duplicateTitles.add(title);
      }
    });

    return duplicateTitles;
  }
}
