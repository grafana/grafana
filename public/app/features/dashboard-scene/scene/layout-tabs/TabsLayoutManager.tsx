import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { t } from 'app/core/internationalization';

import {
  NewObjectAddedToCanvasEvent,
  ObjectRemovedFromCanvasEvent,
  ObjectsReorderedOnCanvasEvent,
} from '../../edit-pane/shared';
import { serializeTabsLayout } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { getDashboardSceneFor } from '../../utils/utils';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { getTabFromClipboard } from '../layouts-shared/paste';
import { generateUniqueTitle, ungroupLayout } from '../layouts-shared/utils';
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
    id: 'TabsLayout',
    createFromLayout: TabsLayoutManager.createFromLayout,
    isGridLayout: false,
    icon: 'window',
  };

  public serialize(): DashboardV2Spec['layout'] {
    return serializeTabsLayout(this);
  }

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
    this.addNewTab(newTab);
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

  public switchToTab(tab: TabItem) {
    this.setState({ currentTabIndex: this.state.tabs.indexOf(tab) });
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

  public addNewTab(tab?: TabItem) {
    const newTab = tab ?? new TabItem({ isNew: true });
    const existingNames = new Set(this.state.tabs.map((tab) => tab.state.title).filter((title) => title !== undefined));
    const newTitle = generateUniqueTitle(newTab.state.title, existingNames);
    if (newTitle !== newTab.state.title) {
      newTab.setState({ title: newTitle });
    }

    this.setState({ tabs: [...this.state.tabs, newTab], currentTabIndex: this.state.tabs.length });
    this.publishEvent(new NewObjectAddedToCanvasEvent(newTab), true);
    return newTab;
  }

  public editModeChanged(isEditing: boolean) {
    this.state.tabs.forEach((tab) => tab.getLayout().editModeChanged?.(isEditing));
  }

  public pasteTab() {
    const scene = getDashboardSceneFor(this);
    const tab = getTabFromClipboard(scene);
    this.addNewTab(tab);
  }

  public activateRepeaters() {
    this.state.tabs.forEach((tab) => tab.getLayout().activateRepeaters?.());
  }

  public shouldUngroup(): boolean {
    return this.state.tabs.length === 1;
  }

  public removeTab(tabToRemove: TabItem) {
    // When removing last tab replace ourselves with the inner tab layout
    if (this.shouldUngroup()) {
      ungroupLayout(this, tabToRemove.state.layout);
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

  public moveTab(_tabKey: string, fromIndex: number, toIndex: number) {
    const tabs = [...this.state.tabs];
    const [removed] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, removed);
    this.setState({ tabs, currentTabIndex: toIndex });
    this.publishEvent(new ObjectsReorderedOnCanvasEvent(this), true);
  }

  public forceSelectTab(tabKey: string) {
    const tabIndex = this.state.tabs.findIndex((tab) => tab.state.key === tabKey);
    const tab = this.state.tabs[tabIndex];

    if (!tab) {
      return;
    }

    const editPane = getDashboardSceneFor(this).state.editPane;
    editPane.selectObject(tab!, tabKey, { force: true, multi: false });
    this.setState({ currentTabIndex: tabIndex });
  }

  public static createEmpty(): TabsLayoutManager {
    const tab = new TabItem();
    return new TabsLayoutManager({ tabs: [tab] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    let tabs: TabItem[] = [];

    if (layout instanceof RowsLayoutManager) {
      for (const row of layout.state.rows) {
        tabs.push(new TabItem({ layout: row.state.layout.clone(), title: row.state.title }));
      }
    } else {
      layout.clearParent();
      tabs.push(new TabItem({ layout: layout }));
    }

    return new TabsLayoutManager({ tabs });
  }

  public getUrlKey(): string {
    let parent = this.parent;
    // Panel edit uses `tab` key already so we are using `dtab` here to not conflict
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

  public duplicateTitles() {
    const titleCounts = new Map<string | undefined, number>();
    const duplicateTitles = new Set<string | undefined>();

    this.state.tabs.forEach((tab) => {
      const title = tab.state.title;
      const count = (titleCounts.get(title) ?? 0) + 1;
      titleCounts.set(title, count);
      if (count > 1) {
        duplicateTitles.add(title);
      }
    });

    return duplicateTitles;
  }
}
