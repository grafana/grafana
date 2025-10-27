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
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { findAllGridTypes } from '../layouts-shared/findAllGridTypes';
import { getTabFromClipboard } from '../layouts-shared/paste';
import { showConvertMixedGridsModal, showUngroupConfirmation } from '../layouts-shared/ungroupConfirmation';
import { generateUniqueTitle, ungroupLayout, GridLayoutType, mapIdToGridLayoutType } from '../layouts-shared/utils';
import { isDashboardLayoutGrid } from '../types/DashboardLayoutGrid';
import { DashboardLayoutGroup, isDashboardLayoutGroup } from '../types/DashboardLayoutGroup';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';
import { LayoutRegistryItem } from '../types/LayoutRegistryItem';

import { TabItem } from './TabItem';
import { TabsLayoutManagerRenderer } from './TabsLayoutManagerRenderer';

interface TabsLayoutManagerState extends SceneObjectState {
  tabs: TabItem[];
  currentTabSlug?: string;
}

export class TabsLayoutManager
  extends SceneObjectBase<TabsLayoutManagerState>
  implements DashboardLayoutManager, DashboardLayoutGroup
{
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
    const tabs = this.getTabsIncludingRepeats();
    const selectedTab = tabs.find((tab) => tab.getSlug() === this.state.currentTabSlug);
    if (selectedTab) {
      return selectedTab;
    }

    // return undefined either if variable is loading or repeats were not processed yet
    for (const tab of tabs) {
      if (tab.state.repeatByVariable) {
        const variable = sceneGraph.lookupVariable(tab.state.repeatByVariable, this);
        if ((variable && variable.state.loading) || !tab.state.repeatedTabs) {
          return;
        }
      }
    }

    // return first tab if no hits and variables finished loading
    return tabs[0];
  }

  public getTabsIncludingRepeats(): TabItem[] {
    return this.state.tabs.reduce<TabItem[]>((acc, tab) => {
      acc.push(tab, ...(tab.state.repeatedTabs ?? []));

      return acc;
    }, []);
  }

  public addPanel(vizPanel: VizPanel) {
    const tab = this.getCurrentTab() ?? this.state.tabs[0];

    if (tab) {
      tab.getLayout().addPanel(vizPanel);
    }
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
      this.getTabsIncludingRepeats()
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
    return this.state.tabs.length === 1;
  }

  public convertAllGridLayouts(gridLayoutType: GridLayoutType) {
    for (const tab of this.state.tabs) {
      switch (gridLayoutType) {
        case GridLayoutType.AutoGridLayout:
          if (!(tab.getLayout() instanceof AutoGridLayoutManager)) {
            tab.switchLayout(AutoGridLayoutManager.createFromLayout(tab.getLayout()));
          }
          break;
        case GridLayoutType.GridLayout:
          if (!(tab.getLayout() instanceof DefaultGridLayoutManager)) {
            tab.switchLayout(DefaultGridLayoutManager.createFromLayout(tab.getLayout()));
          }
          break;
      }
    }
  }

  public ungroupTabs() {
    const hasNonGridLayout = this.state.tabs.some((tab) => !tab.getLayout().descriptor.isGridLayout);
    const gridTypes = new Set(findAllGridTypes(this));

    showUngroupConfirmation({
      hasNonGridLayout,
      gridTypes,
      onConfirm: (gridLayoutType) => {
        this.wrapUngroupTabsInEdit(gridLayoutType);
      },
      onConvertMixedGrids: (availableIds) => {
        this._confirmConvertMixedGrids(availableIds);
      },
    });
  }

  private _confirmConvertMixedGrids(availableIds: Set<string>) {
    showConvertMixedGridsModal(availableIds, (id: string) => {
      const selected = mapIdToGridLayoutType(id);
      if (selected) {
        this.wrapUngroupTabsInEdit(selected);
      }
    });
  }

  private wrapUngroupTabsInEdit(gridLayoutType: GridLayoutType) {
    const parent = this.parent;
    if (!parent || !isLayoutParent(parent)) {
      throw new Error('Ungroup tabs failed: parent is not a layout container');
    }

    const previousLayout = this.clone({});
    const scene = getDashboardSceneFor(this);

    dashboardEditActions.edit({
      description: t('dashboard.tabs-layout.edit.ungroup-tabs', 'Ungroup tabs'),
      source: scene,
      perform: () => {
        this.ungroup(gridLayoutType);
      },
      undo: () => {
        parent.switchLayout(previousLayout);
      },
    });
  }

  public ungroup(gridLayoutType: GridLayoutType) {
    const hasNonGridLayout = this.state.tabs.some((tab) => !tab.getLayout().descriptor.isGridLayout);

    if (hasNonGridLayout) {
      for (const tab of this.state.tabs) {
        const layout = tab.getLayout();
        if (!layout.descriptor.isGridLayout) {
          if (isDashboardLayoutGroup(layout)) {
            layout.ungroup(gridLayoutType);
          } else {
            throw new Error(`Ungrouping not supported for layout type: ${layout.descriptor.name}`);
          }
        }
      }
    }

    this.convertAllGridLayouts(gridLayoutType);

    const firstTab = this.state.tabs[0];
    const firstTabLayout = firstTab.getLayout();
    const otherTabs = this.state.tabs.slice(1);

    for (const tab of otherTabs) {
      const layout = tab.getLayout();
      if (isDashboardLayoutGrid(firstTabLayout) && isDashboardLayoutGrid(layout)) {
        firstTabLayout.mergeGrid(layout);
      } else {
        throw new Error(`Layout type ${firstTabLayout.descriptor.name} does not support merging`);
      }
    }

    this.setState({ tabs: [firstTab] });
    ungroupLayout(this, firstTab.state.layout, true);
  }

  public removeTab(tabToRemove: TabItem, skipUndo?: boolean) {
    const tabIndex = this.state.tabs.findIndex((t) => t === tabToRemove);

    const perform = () => {
      const tabs = this.state.tabs;
      const tabIndex = tabs.findIndex((t) => t === tabToRemove);
      const newCurrentTabIndex = tabIndex > 0 ? tabIndex - 1 : 0;

      const newTabsState = tabs.filter((t) => t !== tabToRemove);

      this.setState({
        tabs: newTabsState,
        currentTabSlug: newTabsState[newCurrentTabIndex]?.getSlug(),
      });
    };

    const undo = () => {
      const tabs = [...this.state.tabs];
      tabs.splice(tabIndex, 0, tabToRemove);
      this.setState({ tabs, currentTabSlug: tabToRemove.getSlug() });
    };

    if (skipUndo) {
      perform();
    } else {
      dashboardEditActions.removeElement({
        removedObject: tabToRemove,
        source: this,
        perform,
        undo,
      });
    }
  }

  public moveTab(fromIndex: number, toIndex: number) {
    // fromIndex and toIndex include repeated tab so we need to find original indexes
    const allTabs = this.getTabsIncludingRepeats();
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
    const tabIndex = this.getTabsIncludingRepeats().findIndex((tab) => tab.state.key === tabKey);
    const tab = this.getTabsIncludingRepeats()[tabIndex];

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

    this.getTabsIncludingRepeats().forEach((tab) => {
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
