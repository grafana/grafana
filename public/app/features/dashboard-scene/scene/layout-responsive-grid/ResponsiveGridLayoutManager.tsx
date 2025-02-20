import { SceneComponentProps, SceneCSSGridLayout, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { joinCloneKeys } from '../../utils/clone';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import {
  getDashboardSceneFor,
  getGridItemKeyForPanelId,
  getPanelIdForVizPanel,
  getVizPanelKeyForPanelId,
} from '../../utils/utils';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { ResponsiveGridItem } from './ResponsiveGridItem';
import { getEditOptions } from './ResponsiveGridLayoutManagerEditor';

interface ResponsiveGridLayoutManagerState extends SceneObjectState {
  layout: SceneCSSGridLayout;
}

export class ResponsiveGridLayoutManager
  extends SceneObjectBase<ResponsiveGridLayoutManagerState>
  implements DashboardLayoutManager
{
  public static Component = ResponsiveGridLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.responsive-layout.name', 'Responsive grid');
    },
    get description() {
      return t('dashboard.responsive-layout.description', 'CSS layout that adjusts to the available space');
    },
    id: 'responsive-grid',
    createFromLayout: ResponsiveGridLayoutManager.createFromLayout,

    kind: 'ResponsiveGridLayout',
  };

  public readonly descriptor = ResponsiveGridLayoutManager.descriptor;

  public static defaultCSS = {
    templateColumns: 'repeat(auto-fit, minmax(400px, auto))',
    autoRows: 'minmax(300px, auto)',
  };

  public constructor(state: ResponsiveGridLayoutManagerState) {
    super(state);

    // @ts-ignore
    this.state.layout.getDragClassCancel = () => 'drag-cancel';
  }

  public addPanel(vizPanel: VizPanel) {
    const panelId = dashboardSceneGraph.getNextPanelId(this);

    vizPanel.setState({ key: getVizPanelKeyForPanelId(panelId) });
    vizPanel.clearParent();

    this.state.layout.setState({
      children: [new ResponsiveGridItem({ body: vizPanel }), ...this.state.layout.state.children],
    });
  }

  public removePanel(panel: VizPanel) {
    const element = panel.parent;
    this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
  }

  public duplicatePanel(panel: VizPanel) {
    const gridItem = panel.parent;
    if (!(gridItem instanceof ResponsiveGridItem)) {
      console.error('Trying to duplicate a panel that is not inside a DashboardGridItem');
      return;
    }

    const newPanelId = dashboardSceneGraph.getNextPanelId(this);
    const grid = this.state.layout;

    const newGridItem = gridItem.clone({
      key: getGridItemKeyForPanelId(newPanelId),
      body: panel.clone({
        key: getVizPanelKeyForPanelId(newPanelId),
      }),
    });

    const sourceIndex = grid.state.children.indexOf(gridItem);
    const newChildren = [...grid.state.children];

    // insert after
    newChildren.splice(sourceIndex + 1, 0, newGridItem);

    grid.setState({ children: newChildren });
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

  public hasVizPanels(): boolean {
    for (const child of this.state.layout.state.children) {
      if (child instanceof ResponsiveGridItem) {
        return true;
      }
    }

    return false;
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

  public addNewRow() {
    const shouldAddRow = this.hasVizPanels();
    const rowsLayout = RowsLayoutManager.createFromLayout(this);

    if (shouldAddRow) {
      rowsLayout.addNewRow();
    }

    getDashboardSceneFor(this).switchLayout(rowsLayout);
  }

  public addNewTab() {
    const shouldAddTab = this.hasVizPanels();
    const tabsLayout = TabsLayoutManager.createFromLayout(this);

    if (shouldAddTab) {
      tabsLayout.addNewTab();
    }

    getDashboardSceneFor(this).switchLayout(tabsLayout);
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
      layout: new SceneCSSGridLayout({
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
