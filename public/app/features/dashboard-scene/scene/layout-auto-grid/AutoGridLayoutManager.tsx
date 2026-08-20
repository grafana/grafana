import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, getAppEvents } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import {
  type SceneComponentProps,
  type SceneObject,
  SceneObjectBase,
  type SceneObjectState,
  VizPanel,
  type SceneGridItemLike,
  useSceneObjectState,
} from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { GRID_CELL_VMARGIN } from 'app/core/constants';
import { type OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import DashboardEmpty from 'app/features/dashboard/dashgrid/DashboardEmpty/DashboardEmpty';

import { addElement } from '../../actions/element/addElement';
import { removeElement } from '../../actions/element/removeElement';
import { edit } from '../../actions/utils/edit';
import { serializeAutoGridLayout } from '../../serialization/layoutSerializers/AutoGridLayoutSerializer';
import { NewObjectAddedToCanvasEvent } from '../../sidebar/events';
import { dashboardSceneGraph, type PanelIdGenerator } from '../../utils/dashboardSceneGraph';
import { trackDropItemCrossLayout } from '../../utils/tracking';
import {
  forceRenderChildren,
  getDashboardSceneFor,
  getGridItemKeyForPanelId,
  getVizPanelKeyForPanelId,
  useDashboard,
} from '../../utils/utils';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { buildGroupEdit, canGroupSelection } from '../layouts-shared/groupLayout';
import { clearClipboard, getAutoGridItemFromClipboard } from '../layouts-shared/paste';
import { type DashboardDropTarget } from '../types/DashboardDropTarget';
import { type DashboardLayoutGrid } from '../types/DashboardLayoutGrid';
import { type DashboardLayoutManager, type GroupTarget, type GroupingResult } from '../types/DashboardLayoutManager';
import { type LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { getSidebarOptions } from './AutoGridLayoutManagerEditor';

interface AutoGridLayoutManagerState extends SceneObjectState {
  layout: AutoGridLayout;
  maxColumnCount: number;
  rowHeight: AutoGridRowHeight;
  columnWidth: AutoGridColumnWidth;
  fillScreen: boolean;
  /** Layout-wide default for content-fit. Per-panel overrides via {@link AutoGridItem} `fitContent`. */
  fitContent?: boolean;
  /**
   * Floor (px envelope) for content-fit panels. Distinct from `rowHeight`,
   * which sizes non-fit panels. `'none'` removes the floor so panels shrink to
   * their content; `undefined` falls back to the row height.
   */
  minHeight?: AutoGridMinHeight;
  maxHeightMode?: AutoGridMaxHeightMode;
  maxHeight?: number;
  matchRowHeights?: boolean;
  /** Whether this grid is currently a drop target */
  isDropTarget?: boolean;
  /** Position index where a placeholder should be shown for external drops */
  dropPosition?: number | null;
}

export type AutoGridColumnWidth = 'narrow' | 'standard' | 'wide' | 'custom' | number;
export type AutoGridRowHeight = 'short' | 'standard' | 'tall' | 'custom' | number;
/** Min height for content-fit panels: `'none'` means no floor (the analog of max height's `'unlimited'`). */
export type AutoGridMinHeight = 'none' | AutoGridRowHeight;
export type AutoGridMaxHeightMode = 'unlimited' | 'short' | 'standard' | 'tall' | 'custom';

/**
 * Feature toggle for the whole auto-height (content-fit) panels feature.
 * Persisted `fitContent` state is kept intact when disabled — only the UI entry
 * points and the runtime sizing behavior are turned off.
 */
export function isAutoHeightPanelsEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardsAutoHeightPanels, false);
}

const AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT = 3;
export const AUTO_GRID_DEFAULT_COLUMN_WIDTH = 'standard';
export const AUTO_GRID_DEFAULT_ROW_HEIGHT = 'standard';

export class AutoGridLayoutManager
  extends SceneObjectBase<AutoGridLayoutManagerState>
  implements DashboardLayoutGrid, DashboardDropTarget
{
  public static Component = AutoGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;
  public readonly isDashboardDropTarget = true as const;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.auto-grid.name', 'Auto');
    },
    get description() {
      return t('dashboard.auto-grid.description', 'Panels resize to fit and form uniform grids');
    },
    id: 'AutoGridLayout',
    createFromLayout: AutoGridLayoutManager.createFromLayout,
    isGridLayout: true,
    icon: 'apps',
  };

  public serialize(isSnapshot?: boolean): DashboardV2Spec['layout'] {
    return serializeAutoGridLayout(this, isSnapshot);
  }

  public readonly descriptor = AutoGridLayoutManager.descriptor;

  public constructor(state: Partial<AutoGridLayoutManagerState>) {
    const maxColumnCount = state.maxColumnCount ?? AUTO_GRID_DEFAULT_MAX_COLUMN_COUNT;
    const columnWidth = state.columnWidth ?? AUTO_GRID_DEFAULT_COLUMN_WIDTH;
    const rowHeight = state.rowHeight ?? AUTO_GRID_DEFAULT_ROW_HEIGHT;
    const fillScreen = state.fillScreen ?? false;
    const fitContent = state.fitContent ?? false;

    super({
      ...state,
      maxColumnCount,
      columnWidth,
      rowHeight,
      fillScreen,
      fitContent,
      layout:
        state.layout ??
        new AutoGridLayout({
          isDraggable: true,
          templateColumns: getTemplateColumnsTemplate(maxColumnCount, columnWidth),
          autoRows: getAutoRowsTemplate(rowHeight, fillScreen, fitContent && isAutoHeightPanelsEnabled()),
        }),
    });

    this.addActivationHandler(() => {
      // Children changes (add/remove/drag between grids, undo/redo) can change
      // whether any panel opts into content-fit, so autoRows must be recomputed.
      this._subs.add(
        this.state.layout.subscribeToState((newState, prevState) => {
          if (newState.children !== prevState.children) {
            this.updateAutoRows();
          }
        })
      );
    });
  }

  public getOutlineChildren(): SceneObject[] {
    const children: SceneObject[] = [];

    for (const child of this.state.layout.state.children) {
      children.push(child.state.body, ...(child.state.repeatedPanels || []));
    }

    return children;
  }

  public getAllGridTypes(): string[] {
    return [AutoGridLayoutManager.descriptor.id];
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    const newGridItem = new AutoGridItem({ body: vizPanel });

    addElement({
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
    let panel;

    try {
      panel = getAutoGridItemFromClipboard(getDashboardSceneFor(this));
    } catch (error) {
      getAppEvents().publish({
        type: AppEvents.alertError.name,
        payload: error instanceof Error ? [error.message, String(error.cause)] : [String(error)],
      });
      return;
    }

    if (config.featureToggles.dashboardNewLayouts) {
      edit({
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

    removeElement({
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

  // panelIdGenerator is a shared counter to ensure unique panel IDs across siblings.
  public duplicate(panelIdGenerator?: PanelIdGenerator): DashboardLayoutManager {
    const children = this.state.layout.state.children;
    const clonedChildren: AutoGridItem[] = [];

    if (children.length) {
      const nextId = panelIdGenerator ?? dashboardSceneGraph.getPanelIdGenerator(children[0].state.body);

      children.forEach((child) => {
        const clone = child.clone({
          key: undefined,
          body: child.state.body.clone({
            key: getVizPanelKeyForPanelId(nextId()),
          }),
        });

        clonedChildren.push(clone);
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

  public mergeGrid(other: DashboardLayoutGrid) {
    const sourceLayout =
      other instanceof AutoGridLayoutManager
        ? other.state.layout
        : AutoGridLayoutManager.createFromLayout(other).state.layout;
    const movedChildren = [...sourceLayout.state.children];

    // Remove from source and append to destination
    sourceLayout.setState({ children: [] });
    movedChildren.forEach((child) => {
      child.clearParent();
    });
    this.state.layout.setState({ children: [...this.state.layout.state.children, ...movedChildren] });
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

  public canGroupSelectionInto(items: SceneObject[], target: GroupTarget): GroupingResult {
    return canGroupSelection(items, target);
  }

  public groupSelectionInto(items: SceneObject[], target: GroupTarget): void {
    const groupEdit = buildGroupEdit(items, target);

    if (!groupEdit) {
      return;
    }

    edit({ ...groupEdit, source: getDashboardSceneFor(this) });
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone({});
  }

  public getOptions(): OptionsPaneItemDescriptor[] {
    return getSidebarOptions(this);
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
    // Fill screen (stretch to fill) and fit content (size to content) are opposites.
    this.setState(fillScreen ? { fillScreen, fitContent: false } : { fillScreen });
    this.updateAutoRows();
  }

  public onFitContentChanged(fitContent: boolean) {
    this.setState(fitContent ? { fitContent, fillScreen: false } : { fitContent });
    this.updateAutoRows();
  }

  public onMinHeightChanged(minHeight: AutoGridMinHeight) {
    if (minHeight === 'custom') {
      const current = this.state.minHeight;
      // 'none' has no pixel equivalent, so entering custom mode starts from the default height.
      minHeight = getNamedHeightInPixels(
        current === undefined || current === 'none' ? AUTO_GRID_DEFAULT_ROW_HEIGHT : current
      );
    }
    this.setState({ minHeight });
  }

  public onMaxHeightModeChanged(maxHeightMode: AutoGridMaxHeightMode | undefined) {
    const maxHeight =
      maxHeightMode === 'custom' ? (this.state.maxHeight ?? getNamedHeightInPixels('standard')) : this.state.maxHeight;
    this.setState({ maxHeightMode, maxHeight });
  }

  public onMaxHeightCustomChanged(maxHeight: number) {
    this.setState({ maxHeightMode: 'custom', maxHeight });
  }

  public onMatchRowHeightsChanged(matchRowHeights: boolean) {
    this.setState({ matchRowHeights });
  }

  public onRowHeightChanged(rowHeight: AutoGridRowHeight) {
    if (rowHeight === 'custom') {
      rowHeight = getNamedHeightInPixels(this.state.rowHeight);
    }

    this.setState({ rowHeight });
    this.updateAutoRows();
  }

  /**
   * Content-fit is active when the layout default is on or any panel opts in.
   * When active, row tracks must be able to grow to a panel's content height.
   *
   * Deliberately does not check plugin capability: plugins load async and
   * nothing recomputes autoRows on load. A permissive `max-content` track is
   * benign — non-fit panels are absolutely positioned and contribute no
   * in-flow height, so the row stays at its floor.
   */
  public hasFitContent(): boolean {
    if (!isAutoHeightPanelsEnabled()) {
      return false;
    }
    if (this.state.fitContent) {
      return true;
    }
    return this.state.layout.state.children.some(
      (child) => child instanceof AutoGridItem && child.state.fitContent === true
    );
  }

  /** Recomputes the grid's `autoRows` from the current state. Call after a per-panel fit change. */
  public updateAutoRows() {
    this.state.layout.setState({
      autoRows: getAutoRowsTemplate(this.state.rowHeight, this.state.fillScreen, this.hasFitContent()),
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

  public addGridItem(gridItem: SceneGridItemLike): void {
    if (!(gridItem instanceof AutoGridItem)) {
      // If it's a DashboardGridItem, convert it to AutoGridItem
      if (gridItem instanceof DashboardGridItem) {
        if (!(gridItem.state.body instanceof VizPanel)) {
          throw new Error('DashboardGridItem body is not a VizPanel');
        }
        const panel = gridItem.state.body;
        panel.clearParent();

        const newGridItem = new AutoGridItem({
          body: panel,
          variableName: gridItem.state.variableName,
        });

        this.state.layout.setState({ children: [...this.state.layout.state.children, newGridItem] });
        return;
      }
      throw new Error('Grid item must be an AutoGridItem or DashboardGridItem');
    }

    // Clear parent before moving
    gridItem.clearParent();

    this.state.layout.setState({ children: [...this.state.layout.state.children, gridItem] });
  }

  public setIsDropTarget(isDropTarget: boolean): void {
    this.setState({ isDropTarget });
  }

  public setDropPosition(position: number | null): void {
    this.setState({ dropPosition: position });
  }

  public draggedGridItemOutside(gridItem: SceneGridItemLike): void {
    if (gridItem instanceof AutoGridItem) {
      this.state.layout.setState({
        children: this.state.layout.state.children.filter((child) => child !== gridItem),
      });
    }
    this.setState({ isDropTarget: false });
  }

  public draggedGridItemInside(gridItem: SceneGridItemLike, position?: number): void {
    trackDropItemCrossLayout(gridItem);
    let newGridItem: AutoGridItem;

    if (gridItem instanceof AutoGridItem) {
      gridItem.clearParent();
      newGridItem = gridItem;
    } else if (gridItem instanceof DashboardGridItem) {
      if (!(gridItem.state.body instanceof VizPanel)) {
        throw new Error('DashboardGridItem body is not a VizPanel');
      }
      const panel = gridItem.state.body;
      panel.clearParent();

      newGridItem = new AutoGridItem({
        body: panel,
        variableName: gridItem.state.variableName,
      });
    } else {
      throw new Error('Grid item must be an AutoGridItem or DashboardGridItem');
    }

    const children = [...this.state.layout.state.children];

    if (position !== undefined && position >= 0 && position <= children.length) {
      // Insert at specific position
      children.splice(position, 0, newGridItem);
    } else {
      // Append to end
      children.push(newGridItem);
    }

    this.state.layout.setState({ children });
    this.setState({ isDropTarget: false, dropPosition: null });
  }
}

function AutoGridLayoutManagerRenderer({ model }: SceneComponentProps<AutoGridLayoutManager>) {
  const dashboard = useDashboard(model);
  const { children } = useSceneObjectState(model.state.layout, { shouldActivateOrKeepAlive: true });

  if (model.parent === dashboard && children.length === 0) {
    return (
      <DashboardEmpty dashboard={dashboard} canCreate={!!dashboard.state.meta.canEdit} key="dashboard-empty-state" />
    );
  }

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

/**
 * Resolves the configured max-height mode to a CSS `max-height` value. The
 * browser enforces the bound; unlimited maps to `none`.
 */
export function getMaxHeightCssValue(
  mode: AutoGridMaxHeightMode | undefined,
  customPixels: number | undefined
): string {
  switch (mode) {
    case 'short':
    case 'standard':
    case 'tall':
      return `${getNamedHeightInPixels(mode)}px`;
    case 'custom':
      return customPixels != null ? `${customPixels}px` : 'none';
    case 'unlimited':
    case undefined:
    default:
      return 'none';
  }
}

/**
 * Resolves the content-fit floor to pixels: `'none'` removes the floor (0),
 * no configured min height falls back to the row height.
 */
export function getFitMinHeightInPixels(minHeight: AutoGridMinHeight | undefined, rowHeight: AutoGridRowHeight) {
  if (minHeight === 'none') {
    return 0;
  }
  return getNamedHeightInPixels(minHeight ?? rowHeight);
}

export function getNamedHeightInPixels(rowHeight: AutoGridRowHeight) {
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

export function getAutoRowsTemplate(rowHeight: AutoGridRowHeight, fillScreen: boolean, hasFitContent?: boolean) {
  const rowHeightPixels = getNamedHeightInPixels(rowHeight);
  // Row tracks always floor at the configured row height. The max grows when:
  //  - fill screen: stretch to fill the viewport (`auto`)
  //  - content-fit present: grow to the tallest panel's content (`max-content`)
  //  - otherwise: fixed at the row height
  const maxRowHeightValue = fillScreen ? 'auto' : hasFitContent ? 'max-content' : `${rowHeightPixels}px`;
  return `minmax(${rowHeightPixels}px, ${maxRowHeightValue})`;
}
