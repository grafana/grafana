import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { DashboardLayoutManager } from '../types/DashboardLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManagerRenderer } from './TabsLayoutManagerRenderer';

interface TabsLayoutManagerState extends SceneObjectState {
  tabs: TabItem[];
  currentTab: TabItem;
}

export class TabsLayoutManager extends SceneObjectBase<TabsLayoutManagerState> implements DashboardLayoutManager {
  public static Component = TabsLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor = {
    get name() {
      return t('dashboard.tabs-layout.name', 'Tabs');
    },
    get description() {
      return t('dashboard.tabs-layout.description', 'Tabs layout');
    },
    id: 'tabs-layout',
    createFromLayout: TabsLayoutManager.createFromLayout,
  };

  public readonly descriptor = TabsLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {
    this.state.currentTab.getLayout().addPanel(vizPanel);
  }

  public removePanel(panel: VizPanel) {
    this.state.currentTab.getLayout().removePanel(panel);
  }

  public duplicatePanel(panel: VizPanel) {
    this.state.currentTab.getLayout().duplicatePanel(panel);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const tab of this.state.tabs) {
      const innerPanels = tab.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public getMaxPanelId(): number {
    return Math.max(...this.state.tabs.map((tab) => tab.getLayout().getMaxPanelId()));
  }

  public addNewRow() {
    this.state.currentTab.getLayout().addNewRow();
  }

  public addNewTab() {
    const currentTab = new TabItem();
    this.setState({ tabs: [...this.state.tabs, currentTab], currentTab });
  }

  public editModeChanged(isEditing: boolean) {
    this.state.tabs.forEach((tab) => tab.getLayout().editModeChanged?.(isEditing));
  }

  public activateRepeaters() {
    this.state.tabs.forEach((tab) => {
      if (!tab.isActive) {
        tab.activate();
      }

      if (!tab.getLayout().isActive) {
        tab.getLayout().activate();
      }
    });
  }

  public removeTab(tab: TabItem) {
    if (this.state.tabs.length === 1) {
      throw new Error('TabsLayoutManager: Cannot remove last tab');
    }

    if (this.state.currentTab === tab) {
      const currentTabIndex = this.state.tabs.indexOf(tab);
      const nextTabIndex = currentTabIndex === 0 ? 1 : currentTabIndex - 1;
      const nextTab = this.state.tabs[nextTabIndex];
      this.setState({ tabs: this.state.tabs.filter((t) => t !== tab), currentTab: nextTab });
      return;
    }

    this.setState({
      tabs: this.state.tabs.filter((tab) => tab !== this.state.currentTab),
      currentTab: this.state.tabs[this.state.tabs.length - 1],
    });
  }

  public changeTab(tab: TabItem) {
    this.setState({ currentTab: tab });
  }

  public static createEmpty(): TabsLayoutManager {
    const tab = new TabItem();
    return new TabsLayoutManager({ tabs: [tab], currentTab: tab });
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    const tab = new TabItem({ layout: layout.clone() });
    return new TabsLayoutManager({ tabs: [tab], currentTab: tab });
  }
}
