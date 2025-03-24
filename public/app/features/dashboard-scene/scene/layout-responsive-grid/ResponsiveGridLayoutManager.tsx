import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { NewObjectAddedToCanvasEvent, ObjectRemovedFromCanvasEvent } from '../../edit-pane/shared';
import { joinCloneKeys } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  forceRenderChildren,
  getGridItemKeyForPanelId,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { ResponsiveGridLayout } from './ResponsiveGridLayout';
import { getEditOptions } from './ResponsiveGridLayoutManagerEditor';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: ResponsiveGridLayout;
}

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = ResponsiveGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.responsive-layout.name', 'Auto grid');
    },
    get description() {
      return t('dashboard.responsive-layout.description', 'Panels resize to fit and form uniform grids');
    },
    id: 'responsive-grid',
    createFromLayout: ResponsiveGridLayoutManager.createFromLayout,
    kind: 'ResponsiveGridLayout',
    isGridLayout: true,
  };

  public readonly descriptor = ResponsiveGridLayoutManager.descriptor;

  public static defaultCSS = {
    templateColumns: 'repeat(auto-fit, minmax(400px, auto))',
    autoRows: 'minmax(300px, auto)',
  };

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.state.layout.setState({
      children: [new ResponsiveGridItem({ body: vizPanel }), ...this.state.layout.state.children],
    });

    this.publishEvent(new NewObjectAddedToCanvasEvent(vizPanel), true);
  }

  public removePanel(panel: VizPanel) {
    const element = panel.parent;
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
    this.publishEvent(new ObjectRemovedFromCanvasEvent(panel), true);
  }

  public duplicate(): DashboardLayoutManager {
    return this.clone({
      key: undefined,
      layout: this.state.layout.clone({
        key: undefined,
        children: this.state.layout.state.children.map((child) =>
          child.clone({
            key: undefined,
            body: child.state.body.clone({
              key: getVizPanelKeyForPanelId(dashboardSceneGraph.getNextPanelId(child.state.body)),
            }),
          })
        ),
      }),
    });
  }

  public duplicatePanel(panel: VizPanel) {
    const gridItem = panel.parent;
    if (!(gridItem instanceof ResponsiveGridItem)) {
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
      if (child instanceof ResponsiveGridItem) {
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
    return this.clone({
      layout: this.state.layout.clone({
        children: this.state.layout.state.children.map((gridItem) => {
          if (gridItem instanceof ResponsiveGridItem) {
            // Get the original panel ID from the gridItem's key
            const panelId = getPanelIdForVizPanel(gridItem.state.body);
            const gridItemKey = joinCloneKeys(ancestorKey, getGridItemKeyForPanelId(panelId));

            return gridItem.clone({
              key: gridItemKey,
              body: gridItem.state.body.clone({
                key: joinCloneKeys(gridItemKey, getVizPanelKeyForPanelId(panelId)),
              }),
            });
          }
          throw new Error('Unexpected child type');
        }),
      }),
    });
  }

  public getOptions(): OptionsPaneItemDescriptor[] {
    return getEditOptions(this);
  }

  public changeColumns(columns: string) {
    this.state.layout.setState({ templateColumns: columns });
  }

  public changeRows(rows: string) {
    this.state.layout.setState({ autoRows: rows });
  }

  public static createEmpty(): ResponsiveGridLayoutManager {
    return new ResponsiveGridLayoutManager({
      layout: new ResponsiveGridLayout({
        children: [],
        templateColumns: ResponsiveGridLayoutManager.defaultCSS.templateColumns,
        autoRows: ResponsiveGridLayoutManager.defaultCSS.autoRows,
      }),
    });
  }

  public static createFromLayout(layout: DashboardLayoutManager): ResponsiveGridLayoutManager {
    const panels = layout.getVizPanels();
    const children: ResponsiveGridItem[] = [];

    for (let panel of panels) {
      children.push(new ResponsiveGridItem({ body: panel.clone() }));
    }

    const layoutManager = ResponsiveGridLayoutManager.createEmpty();
    layoutManager.state.layout.setState({ children });

    return layoutManager;
  }
}

function ResponsiveGridLayoutManagerRenderer({ model }: SceneComponentProps<ResponsiveGridLayoutManager>) {
  return <model.state.layout.Component model={model.state.layout} />;
}
