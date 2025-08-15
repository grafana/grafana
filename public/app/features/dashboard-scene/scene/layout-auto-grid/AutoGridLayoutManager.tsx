import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { GRID_CELL_VMARGIN } from 'app/core/constants';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { dashboardEditActions, NewObjectAddedToCanvasEvent } from '../../edit-pane/shared';
import { serializeAutoGridLayout } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  forceRenderChildren,
  getDashboardSceneFor,
  getGridItemKeyForPanelId,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { clearClipboard, getAutoGridItemFromClipboard } from '../layouts-shared/paste';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { getEditOptions } from './AutoGridLayoutManagerEditor';

interface AutoGridLayoutManagerState extends SceneObjectState {
  layout: AutoGridLayout;
  maxColumnCount: number;
  rowHeight: AutoGridRowHeight;
  columnWidth: AutoGridColumnWidth;
  fillScreen: boolean;
}

export type AutoGridColumnWidth = 'narrow' | 'standard' | 'wide' | 'custom' | number;
export type AutoGridRowHeight = 'short' | 'standard' | 'tall' | 'custom' | number;

export const AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT = 3;
export const AUTO_GRID_DEFAULT_COLUMN_WIDTH = 'standard';
export const AUTO_GRID_DEFAULT_ROW_HEIGHT = 'standard';

export class AutoGridLayoutManager
  extends SceneObjectBase<AutoGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = AutoGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.auto-grid.name', 'Auto grid');
    },
    get description() {
      return t('dashboard.auto-grid.description', 'Panels resize to fit and form uniform grids');
    },
    id: 'AutoGridLayout',
    createFromLayout: AutoGridLayoutManager.createFromLayout,
    isGridLayout: true,
    icon: 'apps',
  };

  public serialize(): DashboardV2Spec['layout'] {
    return serializeAutoGridLayout(this);
  }

  public readonly descriptor = AutoGridLayoutManager.descriptor;

  public constructor(state: Partial<AutoGridLayoutManagerState>) {
    const maxColumnCount = state.maxColumnCount ?? AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT;
    const columnWidth = state.columnWidth ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH;
    const rowHeight = state.rowHeight ?? AUTO_GRID_DEFAULT_ROW_HEIGHT;
    const fillScreen = state.fillScreen ?? false;

    super({
      ...state,
      maxColumnCount,
      columnWidth,
      rowHeight,
      fillScreen,
      layout:
        state.layout ??
        new AutoGridLayout({
          isDraggable: true,
          templateColumns: getTemplateColumnsTemplate(maxColumnCount, columnWidth),
          autoRows: getAutoRowsTemplate(rowHeight, fillScreen),
        }),
    });
  }

  public getOutlineChildren(): SceneObject[] {
    const outlineChildren = this.state.layout.state.children.map((gridItem) => gridItem.state.body);
    return outlineChildren;
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    const newGridItem = new AutoGridItem({ body: vizPanel });

    dashboardEditActions.addElement({
      addedObject: vizPanel,
      source: this,
      perform: () => {
        this.state.layout.setState({ children: [...this.state.layout.state.children, newGridItem] });
      },
      undo: () => {
        this.state.layout.setState({
          children: this.state.layout.state.children.filter((child) => child !== newGridItem),
        });
      },
    });
  }

  public pastePanel() {
    const panel = getAutoGridItemFromClipboard(getDashboardSceneFor(this));
    if (config.featureToggles.dashboardNewLayouts) {
      dashboardEditActions.edit({
        description: t('dashboard.edit-actions.paste-panel', 'Paste panel'),
        addedObject: panel.state.body,
        source: this,
        perform: () => {
          this.state.layout.setState({ children: [...this.state.layout.state.children, panel] });
        },
        undo: () => {
          this.state.layout.setState({
            children: this.state.layout.state.children.filter((child) => child !== panel),
          });
        },
      });
    } else {
      this.state.layout.setState({ children: [...this.state.layout.state.children, panel] });
      this.publishEvent(new NewObjectAddedToCanvasEvent(panel), true);
    }

    clearClipboard();
  }

  public removePanel(panel: VizPanel) {
    const gridItem = panel.parent;
    if (!(gridItem instanceof AutoGridItem)) {
      return;
    }

    const gridItemIndex = this.state.layout.state.children.indexOf(gridItem);

    dashboardEditActions.removeElement({
      removedObject: panel,
      source: this,
      perform: () => {
        this.state.layout.setState({
          children: this.state.layout.state.children.filter((child) => child !== gridItem),
        });
      },
      undo: () => {
        this.state.layout.setState({
          children: [
            ...this.state.layout.state.children.slice(0, gridItemIndex),
            gridItem,
            ...this.state.layout.state.children.slice(gridItemIndex),
          ],
        });
      },
    });
  }

  public duplicate(): DashboardLayoutManager {
    const children = this.state.layout.state.children;
    const clonedChildren: AutoGridItem[] = [];

    if (children.length) {
      let panelId = dashboardSceneGraph.getNextPanelId(children[0].state.body);

      children.forEach((child) => {
        const clone = child.clone({
          key: undefined,
          body: child.state.body.clone({
            key: getVizPanelKeyForPanelId(panelId),
          }),
        });

        clonedChildren.push(clone);
        panelId++;
      });
    }

    return this.clone({
      key: undefined,
      layout: this.state.layout.clone({
        key: undefined,
        children: clonedChildren,
      }),
    });
  }

  public duplicatePanel(panel: VizPanel) {
    const gridItem = panel.parent;
    if (!(gridItem instanceof AutoGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.layout;

    const newPanel = panel.clone({
      key: getVizPanelKeyForPanelId(newPanelId),
    });

    const newGridItem = gridItem.clone({
      key: getGridItemKeyForPanelId(newPanelId),
      body: newPanel,
    });

    const sourceIndex = grid.state.children.indexOf(gridItem);
    const newChildren = [...grid.state.children];

    // insert after
    newChildren.splice(sourceIndex + 1, 0, newGridItem);

    grid.setState({ children: newChildren });

    this.publishEvent(new NewObjectAddedToCanvasEvent(newPanel), true);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const child of this.state.layout.state.children) {
      if (child instanceof AutoGridItem) {
        panels.push(child.state.body);
      }
    }

    return panels;
  }

  public editModeChanged(isEditing: boolean) {
    this.state.layout.setState({ isDraggable: isEditing });
    forceRenderChildren(this.state.layout, true);
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({});
  }

  public getOptions(): OptionsPaneItemDescriptor[] {
    return getEditOptions(this);
  }

  public onMaxColumnCountChanged(maxColumnCount: number) {
    this.setState({ maxColumnCount: maxColumnCount });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(maxColumnCount, this.state.columnWidth),
    });
  }

  public onColumnWidthChanged(columnWidth: AutoGridColumnWidth) {
    if (columnWidth === 'custom') {
      columnWidth = getNamedColumWidthInPixels(this.state.columnWidth);
    }

    this.setState({ columnWidth: columnWidth });
    this.state.layout.setState({
      templateColumns: getTemplateColumnsTemplate(this.state.maxColumnCount, this.state.columnWidth),
    });
  }

  public onFillScreenChanged(fillScreen: boolean) {
    this.setState({ fillScreen });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(this.state.rowHeight, fillScreen),
    });
  }

  public onRowHeightChanged(rowHeight: AutoGridRowHeight) {
    if (rowHeight === 'custom') {
      rowHeight = getNamedHeightInPixels(this.state.rowHeight);
    }

    this.setState({ rowHeight });
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(rowHeight, this.state.fillScreen),
    });
  }

  public static createEmpty(): AutoGridLayoutManager {
    return new AutoGridLayoutManager({});
  }

  public static createFromLayout(layout: DashboardLayoutManager): AutoGridLayoutManager {
    const panels = layout.getVizPanels();
    const children: AutoGridItem[] = [];

    for (let panel of panels) {
      const variableName = panel.parent instanceof DashboardGridItem ? panel.parent.state.variableName : undefined;
      children.push(new AutoGridItem({ body: panel.clone(), variableName }));
    }

    const layoutManager = AutoGridLayoutManager.createEmpty();
    layoutManager.state.layout.setState({
      children,
      isDraggable: getDashboardSceneFor(layout).state.isEditing,
    });

    return layoutManager;
  }
}

function AutoGridLayoutManagerRenderer({ model }: SceneComponentProps<AutoGridLayoutManager>) {
  return <model.state.layout.Component model={model.state.layout} />;
}

export function getTemplateColumnsTemplate(maxColumnCount: number, columnWidth: AutoGridColumnWidth) {
  return `repeat(auto-fit, minmax(min(max(100% / ${maxColumnCount} - ${GRID_CELL_VMARGIN}px, ${getNamedColumWidthInPixels(columnWidth)}px), 100%), 1fr))`;
}

function getNamedColumWidthInPixels(columnWidth: AutoGridColumnWidth) {
  if (typeof columnWidth === 'number') {
    return columnWidth;
  }

  switch (columnWidth) {
    case 'narrow':
      return 192;
    case 'wide':
      return 768;
    case 'custom':
    case 'standard':
    default:
      return 448;
  }
}

function getNamedHeightInPixels(rowHeight: AutoGridRowHeight) {
  if (typeof rowHeight === 'number') {
    return rowHeight;
  }

  switch (rowHeight) {
    case 'short':
      return 168;
    case 'tall':
      return 512;
    case 'custom':
    case 'standard':
    default:
      return 320;
  }
}

export function getAutoRowsTemplate(rowHeight: AutoGridRowHeight, fillScreen: boolean) {
  const rowHeightPixels = getNamedHeightInPixels(rowHeight);
  const maxRowHeightValue = fillScreen ? 'auto' : `${rowHeightPixels}px`;
  return `minmax(${rowHeightPixels}px, ${maxRowHeightValue})`;
}
