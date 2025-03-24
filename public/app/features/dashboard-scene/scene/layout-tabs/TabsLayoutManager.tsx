import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { t } from 'app/core/internationalization';

import {
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
} from '../../edit-pane/shared';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { TabItem } from './TabItem';
import { TabsLayoutManagerRenderer } from './TabsLayoutManagerRenderer';

interface TabsLayoutManagerState extends SceneObjectState {
  tabs: TabItem[];
  currentTabIndex: number;
}

export class TabsLayoutManager extends SceneObjectBase<TabsLayoutManagerState> implements DashboardLayoutManager {
  public static Component = TabsLayoutManagerRenderer;

  public readonly isDashboardLayoutManager = true;

  public static readonly descriptor: LayoutRegistryItem = {
    get name() {
      return t('dashboard.tabs-layout.name', 'Tabs');
    },
    get description() {
      return t('dashboard.tabs-layout.description', 'Organize panels into horizontal tabs');
    },
    id: 'tabs-layout',
    createFromLayout: TabsLayoutManager.createFromLayout,
    kind: 'TabsLayout',
    isGridLayout: false,
  };

  public readonly descriptor = TabsLayoutManager.descriptor;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: () => [this.getUrlKey()] });

  public constructor(state: Partial<TabsLayoutManagerState>) {
    super({
      ...state,
      tabs: state.tabs ?? [new TabItem()],
      currentTabIndex: state.currentTabIndex ?? 0,
    });
  }

  public duplicate(): DashboardLayoutManager {
    // Maybe not needed, depending on if we want nested tabs or tabs within rows
    throw new Error('Method not implemented.');
  }

  public duplicateTab(tab: TabItem) {
    const newTab = tab.duplicate();
    this.setState({ tabs: [...this.state.tabs, newTab] });
  }

  public getUrlState() {
    const key = this.getUrlKey();
    return { [key]: this.getCurrentTab().getSlug() };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const key = this.getUrlKey();
    const urlValue = values[key];

    if (!urlValue) {
      return;
    }

    if (typeof values[key] === 'string') {
      // find tab with matching slug
      const matchIndex = this.state.tabs.findIndex((tab) => tab.getSlug() === urlValue);
      if (matchIndex !== -1) {
        this.setState({ currentTabIndex: matchIndex });
      }
    }
  }

  public getCurrentTab(): TabItem {
    return this.state.tabs.length > this.state.currentTabIndex
      ? this.state.tabs[this.state.currentTabIndex]
      : this.state.tabs[0];
  }

  public addPanel(vizPanel: VizPanel) {
    this.getCurrentTab().getLayout().addPanel(vizPanel);
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const tab of this.state.tabs) {
      const innerPanels = tab.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    throw new Error('Method not implemented.');
  }

  public addNewTab() {
    const newTab = new TabItem();
    this.setState({ tabs: [...this.state.tabs, newTab], currentTabIndex: this.state.tabs.length });
    this.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);
    return newTab;
  }

  public editModeChanged(isEditing: boolean) {
    this.state.tabs.forEach((tab) => tab.getLayout().editModeChanged?.(isEditing));
  }

  public activateRepeaters() {
    this.state.tabs.forEach((tab) => tab.getLayout().activateRepeaters?.());
  }

  public removeTab(tabToRemove: TabItem) {
    // Do not allow removing last tab (for now)
    if (this.state.tabs.length === 1) {
      return;
    }

    const currentTab = this.getCurrentTab();

    if (currentTab === tabToRemove) {
      const nextTabIndex = this.state.currentTabIndex > 0 ? this.state.currentTabIndex - 1 : 0;
      this.setState({ tabs: this.state.tabs.filter((t) => t !== tabToRemove), currentTabIndex: nextTabIndex });
      this.publishEvent(new ObjectRemovedFromCanvasEvent(tabToRemove), true);
      return;
    }

    const filteredTab = this.state.tabs.filter((tab) => tab !== tabToRemove);
    const tabs = filteredTab.length === 0 ? [new TabItem()] : filteredTab;

    this.setState({ tabs, currentTabIndex: 0 });
    this.publishEvent(new ObjectRemovedFromCanvasEvent(tabToRemove), true);
  }

  public addTabBefore(tab: TabItem): TabItem {
    const newTab = new TabItem();
    const tabs = this.state.tabs.slice();
    tabs.splice(tabs.indexOf(tab), 0, newTab);
    this.setState({ tabs, currentTabIndex: this.state.currentTabIndex });
    this.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);

    return newTab;
  }

  public addTabAfter(tab: TabItem): TabItem {
    const newTab = new TabItem();
    const tabs = this.state.tabs.slice();
    tabs.splice(tabs.indexOf(tab) + 1, 0, newTab);
    this.setState({ tabs, currentTabIndex: this.state.currentTabIndex + 1 });
    this.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);

    return newTab;
  }

  public moveTabLeft(tab: TabItem) {
    const currentIndex = this.state.tabs.indexOf(tab);
    if (currentIndex <= 0) {
      return;
    }
    const tabs = this.state.tabs.slice();
    tabs.splice(currentIndex, 1);
    tabs.splice(currentIndex - 1, 0, tab);
    this.setState({ tabs, currentTabIndex: this.state.currentTabIndex - 1 });
    this.publishEvent(new ObjectsReorderedOnCanvasEvent(this), true);
  }

  public moveTabRight(tab: TabItem) {
    const currentIndex = this.state.tabs.indexOf(tab);
    if (currentIndex >= this.state.tabs.length - 1) {
      return;
    }
    const tabs = this.state.tabs.slice();
    tabs.splice(currentIndex, 1);
    tabs.splice(currentIndex + 1, 0, tab);
    this.setState({ tabs, currentTabIndex: this.state.currentTabIndex + 1 });
    this.publishEvent(new ObjectsReorderedOnCanvasEvent(this), true);
  }

  public isFirstTab(tab: TabItem): boolean {
    return this.state.tabs[0] === tab;
  }

  public isLastTab(tab: TabItem): boolean {
    return this.state.tabs[this.state.tabs.length - 1] === tab;
  }

  public static createEmpty(): TabsLayoutManager {
    const tab = new TabItem();
    return new TabsLayoutManager({ tabs: [tab] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    let tabs: TabItem[] = [];

    if (layout instanceof RowsLayoutManager) {
      tabs = layout.state.rows.map((row) => new TabItem({ layout: row.state.layout.clone(), title: row.state.title }));
    } else {
      tabs.push(new TabItem({ layout: layout.clone() }));
    }

    return new TabsLayoutManager({ tabs });
  }

  getUrlKey(): string {
    let parent = this.parent;
    // Panel edit uses tab key already so we are using dtab here to not conflict
    let key = 'dtab';

    while (parent) {
      if (parent instanceof TabItem) {
        key = `${parent.getSlug()}-${key}`;
      }

      if (parent instanceof RowItem) {
        key = `${parent.getSlug()}-${key}`;
      }

      parent = parent.parent;
    }

    return key;
  }
}
