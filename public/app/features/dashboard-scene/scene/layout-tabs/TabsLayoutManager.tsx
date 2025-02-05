import { SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { TabItem } from './TabItem';
import { TabItemRepeaterBehavior } from './TabItemRepeaterBehavior';
import { TabsLayoutManagerRenderer } from './TabsLayoutManagerRenderer';

interface TabsLayoutManagerState extends SceneObjectState {
  tabs: TabItem[];
  currentTab: TabItem;
}

export class TabsLayoutManager extends SceneObjectBase<TabsLayoutManagerState> implements DashboardLayoutManager {
  public static Component = TabsLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.tabs-layout.name', 'Tabs');
    },
    get description() {
      return t('dashboard.tabs-layout.description', 'Tabs layout');
    },
    id: 'tabs-layout',
    createFromLayout: TabsLayoutManager.createFromLayout,

    kind: 'TabsLayout',
  };

  public readonly descriptor = TabsLayoutManager.descriptor;

  public addPanel(vizPanel: VizPanel) {
    this.state.currentTab.onAddPanel(vizPanel);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const tab of this.state.tabs) {
      const innerPanels = tab.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public hasVizPanels(): boolean {
    for (const tab of this.state.tabs) {
      if (tab.getLayout().hasVizPanels()) {
        return true;
      }
    }

    return false;
  }

  public addNewRow() {
    this.state.currentTab.getLayout().addNewRow();
  }

  public addNewTab() {
    const currentTab = new TabItem({
      $behaviors: [ConditionalRendering.createEmpty()],
    });
    this.setState({ tabs: [...this.state.tabs, currentTab], currentTab });
  }

  public editModeChanged(isEditing: boolean) {
    this.state.tabs.forEach((tab) => tab.getLayout().editModeChanged?.(isEditing));
  }

  public activateRepeaters() {
    this.state.tabs.forEach((tab) => tab.getLayout().activateRepeaters?.());
  }

  public addTabBefore(tab: TabItem) {
    const newTab = new TabItem();
    const tabs = this.state.tabs.slice();
    tabs.splice(tabs.indexOf(tab), 0, newTab);
    this.setState({ tabs, currentTab: newTab });
  }

  public addTabAfter(tab: TabItem) {
    const newTab = new TabItem();
    const tabs = this.state.tabs.slice();
    tabs.splice(tabs.indexOf(tab) + 1, 0, newTab);
    this.setState({ tabs, currentTab: newTab });
  }

  public moveTabLeft(tab: TabItem) {
    const currentIndex = this.state.tabs.indexOf(tab);
    const tabs = this.state.tabs.slice();
    tabs.splice(currentIndex, 1);
    tabs.splice(currentIndex - 1, 0, tab);
    this.setState({ tabs });
  }

  public moveTabRight(tab: TabItem) {
    const currentIndex = this.state.tabs.indexOf(tab);
    const tabs = this.state.tabs.slice();
    tabs.splice(currentIndex, 1);
    tabs.splice(currentIndex + 1, 0, tab);
    this.setState({ tabs });
  }

  public isCurrentTab(tab: TabItem): boolean {
    return this.state.currentTab === tab;
  }

  public isFirstTab(tab: TabItem): boolean {
    return this.state.tabs[0] === tab;
  }

  public isLastTab(tab: TabItem): boolean {
    return this.state.tabs[this.state.tabs.length - 1] === tab;
  }

  public removeTab(tab: TabItem) {
    if (this.state.currentTab === tab) {
      const currentTabIndex = this.state.tabs.indexOf(tab);
      const nextTabIndex = currentTabIndex === 0 ? 1 : currentTabIndex - 1;
      const nextTab = this.state.tabs[nextTabIndex];
      this.setState({ tabs: this.state.tabs.filter((t) => t !== tab), currentTab: nextTab });
      return;
    }

    const filteredTab = this.state.tabs.filter((tab) => tab !== this.state.currentTab);
    const tabs =
      filteredTab.length === 0
        ? [
            new TabItem({
              $behaviors: [ConditionalRendering.createEmpty()],
            }),
          ]
        : filteredTab;

    this.setState({ tabs, currentTab: tabs[tabs.length - 1] });
  }

  public changeTab(tab: TabItem) {
    if (this.state.currentTab !== tab) {
      this.setState({ currentTab: tab });
    }
  }

  public static createEmpty(): TabsLayoutManager {
    const tab = new TabItem({
      $behaviors: [ConditionalRendering.createEmpty()],
    });
    return new TabsLayoutManager({ tabs: [tab], currentTab: tab });
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    const tab = new TabItem({
      layout: layout.clone(),
      $behaviors: [ConditionalRendering.createEmpty()],
    });
    return new TabsLayoutManager({ tabs: [tab], currentTab: tab });
  }
}
