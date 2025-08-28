import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  VizPanel,
} from '@grafana/scenes';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { dashboardEditActions, ObjectsReorderedOnCanvasEvent } from '../../edit-pane/shared';
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
  currentTabSlug?: string;
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
    return { [key]: this.state.currentTabSlug };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    const key = this.getUrlKey();
    const urlValue = values[key];

    if (!urlValue) {
      return;
    }

    if (typeof values[key] === 'string') {
      this.setState({ currentTabSlug: values[key] });
    }
  }

  public switchToTab(tab: TabItem) {
    this.setState({ currentTabSlug: tab.getSlug() });
  }

  public getCurrentTab(): TabItem | undefined {
    const tabs = this.getTabs();
    const selectedTab = tabs.find((tab) => tab.getSlug() === this.state.currentTabSlug);
    if (selectedTab) {
      return selectedTab;
    }

    // if loading return undefined
    for (const tab of tabs) {
      if (tab.state.repeatByVariable) {
        const variable = sceneGraph.lookupVariable(tab.state.repeatByVariable, this);
        if (variable && variable.state.loading) {
          return;
        }
      }
    }

    // return first tab if no hits and variables finished loading
    this.setState({ currentTabSlug: tabs[0].getSlug() });
    return tabs[0];
  }

  public getTabs(): TabItem[] {
    return this.state.tabs.reduce<TabItem[]>((acc, tab) => {
      acc.push(tab, ...(tab.state.repeatedTabs ?? []));

      return acc;
    }, []);
  }

  public addPanel(vizPanel: VizPanel) {
    const tab = this.getCurrentTab();

    if (tab) {
      tab.getLayout().addPanel(vizPanel);
    }
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const tab of this.getTabs()) {
      const innerPanels = tab.getLayout().getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public cloneLayout(ancestorKey: string, isSource: boolean): DashboardLayoutManager {
    return this.clone();
  }

  public getOutlineChildren() {
    const outlineChildren: SceneObject[] = [];

    for (const tab of this.state.tabs) {
      outlineChildren.push(tab);

      if (tab.state.repeatedTabs) {
        for (const clone of tab.state.repeatedTabs!) {
          outlineChildren.push(clone);
        }
      }
    }

    return outlineChildren;
  }

  public addNewTab(tab?: TabItem) {
    const newTab = tab ?? new TabItem({});
    const existingNames = new Set(
      this.getTabs()
        .map((tab) => tab.state.title)
        .filter((title) => title !== undefined)
    );
    const newTitle = generateUniqueTitle(newTab.state.title, existingNames);
    if (newTitle !== newTab.state.title) {
      newTab.setState({ title: newTitle });
    }

    dashboardEditActions.addElement({
      addedObject: newTab,
      source: this,
      perform: () => this.setState({ tabs: [...this.state.tabs, newTab], currentTabSlug: newTab.getSlug() }),
      undo: () => {
        this.setState({
          tabs: this.state.tabs.filter((t) => t !== newTab),
          // if the new tab was the current tab, set the current tab to the previous tab
          currentTabSlug: this.state.currentTabSlug === newTab.getSlug() ? undefined : this.state.currentTabSlug,
        });
      },
    });

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

  public shouldUngroup(): boolean {
    return this.getTabs().length === 1;
  }

  public removeTab(tabToRemove: TabItem) {
    // When removing last tab replace ourselves with the inner tab layout
    if (this.shouldUngroup()) {
      ungroupLayout(this, tabToRemove.state.layout);
      return;
    }

    const tabIndex = this.state.tabs.findIndex((t) => t === tabToRemove);

    dashboardEditActions.removeElement({
      removedObject: tabToRemove,
      source: this,
      perform: () => {
        const tabs = this.state.tabs;
        const tabIndex = tabs.findIndex((t) => t === tabToRemove);
        const newCurrentTabIndex = tabIndex > 0 ? tabIndex - 1 : 0;

        this.setState({
          tabs: tabs.filter((t) => t !== tabToRemove),
          currentTabSlug: tabs[newCurrentTabIndex]?.getSlug(),
        });
      },
      undo: () => {
        const tabs = [...this.state.tabs];
        tabs.splice(tabIndex, 0, tabToRemove);
        this.setState({ tabs, currentTabSlug: tabToRemove.getSlug() });
      },
    });
  }

  public moveTab(fromIndex: number, toIndex: number) {
    // fromIndex and toIndex include repeated tab so we need to find original indexes
    const allTabs = this.getTabs();
    const objectToMove = allTabs[fromIndex];
    let destinationTab = allTabs[toIndex];
    let selectionIndex = toIndex;

    if (destinationTab.state.repeatSourceKey) {
      if (destinationTab.state.repeatSourceKey === objectToMove.state.repeatSourceKey) {
        // moving tab between its clones
        return;
      }

      const sourceTabIndx = allTabs.findIndex((tab) => tab.state.key === destinationTab.state.repeatSourceKey);

      if (sourceTabIndx !== -1) {
        destinationTab = allTabs[sourceTabIndx];

        const isMovingLeft = toIndex < fromIndex;
        selectionIndex = sourceTabIndx + (isMovingLeft ? 0 : destinationTab.state.repeatedTabs?.length || 0);
      }
    }

    const originalFromIndex = this.state.tabs.findIndex((tab) => tab === objectToMove);
    const originalToIndex = this.state.tabs.findIndex((tab) => tab === destinationTab);

    dashboardEditActions.moveElement({
      source: this,
      movedObject: objectToMove,
      perform: () => {
        this.rearrangeTabs(originalFromIndex, originalToIndex, selectionIndex);
      },
      undo: () => {
        this.rearrangeTabs(originalToIndex, originalFromIndex, fromIndex);
      },
    });
  }

  private rearrangeTabs(fromIndex: number, toIndex: number, selectedTabIndex: number) {
    const tabs = [...this.state.tabs];
    const [removed] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, removed);
    this.setState({ tabs });
    this.publishEvent(new ObjectsReorderedOnCanvasEvent(this), true);
  }

  public forceSelectTab(tabKey: string) {
    const tabIndex = this.getTabs().findIndex((tab) => tab.state.key === tabKey);
    const tab = this.getTabs()[tabIndex];

    if (!tab) {
      return;
    }

    const editPane = getDashboardSceneFor(this).state.editPane;
    editPane.selectObject(tab!, tabKey, { force: true, multi: false });
    this.setState({ currentTabSlug: tab.getSlug() });
  }

  public static createEmpty(): TabsLayoutManager {
    const tab = new TabItem();
    return new TabsLayoutManager({ tabs: [tab] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): TabsLayoutManager {
    let tabs: TabItem[] = [];

    if (layout instanceof RowsLayoutManager) {
      for (const row of layout.state.rows) {
        if (row.state.repeatSourceKey) {
          continue;
        }

        const conditionalRendering = row.state.conditionalRendering;
        conditionalRendering?.clearParent();

        tabs.push(
          new TabItem({
            layout: row.state.layout.clone(),
            title: row.state.title,
            conditionalRendering,
            repeatByVariable: row.state.repeatByVariable,
          })
        );
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

    this.getTabs().forEach((tab) => {
      const title = sceneGraph.interpolate(tab, tab.state.title);
      const count = (titleCounts.get(title) ?? 0) + 1;
      titleCounts.set(title, count);
      if (count > 1) {
        duplicateTitles.add(title);
      }
    });

    return duplicateTitles;
  }
}
