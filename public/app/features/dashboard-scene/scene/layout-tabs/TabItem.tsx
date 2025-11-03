import React from 'react';

import { t } from '@grafana/i18n';
import {
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  VariableDependencyConfig,
  SceneObject,
  SceneGridItemLike,
  SceneGridLayout,
} from '@grafana/scenes';
import { TabsLayoutTabKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { LS_TAB_COPY_KEY } from 'app/core/constants';
import { appEvents } from 'app/core/core';
import store from 'app/core/store';
import kbn from 'app/core/utils/kbn';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ConditionalRenderingGroup } from '../../conditional-rendering/group/ConditionalRenderingGroup';
import { serializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { getElements } from '../../serialization/layoutSerializers/utils';
import { getDashboardSceneFor } from '../../utils/utils';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { clearClipboard } from '../layouts-shared/paste';
import { scrollCanvasElementIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardDropTarget } from '../types/DashboardDropTarget';
import { isDashboardLayoutGrid } from '../types/DashboardLayoutGrid';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { useEditOptions } from './TabItemEditor';
import { TabItemRenderer } from './TabItemRenderer';
import { TabItems } from './TabItems';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface TabItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isDropTarget?: boolean;
  conditionalRendering?: ConditionalRenderingGroup;
  repeatByVariable?: string;
  repeatedTabs?: TabItem[];
  /** Marks object as a repeated object and a key pointer to source object */
  repeatSourceKey?: string;
}

export class TabItem
  extends SceneObjectBase<TabItemState>
  implements LayoutParent, BulkActionElement, EditableDashboardElement, DashboardDropTarget
{
  public static Component = TabItemRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public readonly isEditableDashboardElement = true;
  public readonly isDashboardDropTarget = true;

  public containerRef = React.createRef<HTMLDivElement>();

  constructor(state?: Partial<TabItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.tabs-layout.tab.new', 'New tab'),
      layout: state?.layout ?? AutoGridLayoutManager.createEmpty(),
      conditionalRendering: state?.conditionalRendering ?? ConditionalRenderingGroup.createEmpty(),
    });

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    const deactivate = this.state.conditionalRendering?.activate();

    return () => {
      if (deactivate) {
        deactivate();
      }
    };
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.edit-pane.elements.tab', 'Tab'),
      instanceName: sceneGraph.interpolate(this, this.state.title, undefined, 'text'),
      icon: 'layers',
    };
  }

  public getOutlineChildren(): SceneObject[] {
    return this.state.layout.getOutlineChildren();
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public getSlug(): string {
    return kbn.slugifyForUrl(sceneGraph.interpolate(this, this.state.title ?? 'Tab'));
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ layout });
  }

  public useEditPaneOptions = useEditOptions.bind(this);

  public onDelete() {
    const layout = this.getParentLayout();
    layout.removeTab(this);
  }

  public onConfirmDelete() {
    const layout = this.getParentLayout();

    if (layout.shouldUngroup()) {
      layout.removeTab(this);
      return;
    }

    if (this.getLayout().getVizPanels().length === 0) {
      this.onDelete();
      return;
    }

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.tabs-layout.delete-tab-title', 'Delete tab?'),
        text: t(
          'dashboard.tabs-layout.delete-tab-text',
          'Deleting this tab will also remove all panels. Are you sure you want to continue?'
        ),
        yesText: t('dashboard.tabs-layout.delete-tab-yes', 'Delete'),
        onConfirm: () => {
          this.onDelete();
        },
      })
    );
  }

  public serialize(): TabsLayoutTabKind {
    return serializeTab(this);
  }

  public onCopy() {
    const elements = getElements(this.getLayout(), getDashboardSceneFor(this));
    clearClipboard();
    store.set(LS_TAB_COPY_KEY, JSON.stringify({ elements, tab: this.serialize() }));
  }

  public createMultiSelectedElement(items: SceneObject[]): TabItems {
    return new TabItems(items.filter((item) => item instanceof TabItem));
  }

  public onDuplicate(): void {
    this.getParentLayout().duplicateTab(this);
  }

  public duplicate(): TabItem {
    return this.clone({ key: undefined, layout: this.getLayout().duplicate() });
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
    const currentTabSlug = this.getSlug();
    this.getParentLayout().setState({ currentTabSlug });
  }

  public onChangeName(name: string): void {
    this.onChangeTitle(name);
  }

  public onChangeRepeat(repeat: string | undefined) {
    if (repeat) {
      this.setState({ repeatByVariable: repeat });
    } else {
      this.setState({ repeatedTabs: undefined, $variables: undefined, repeatByVariable: undefined });
    }
  }

  public setIsDropTarget(isDropTarget: boolean) {
    if (!!this.state.isDropTarget !== isDropTarget) {
      this.setState({ isDropTarget });
    }
  }

  public draggedGridItemOutside?(gridItem: SceneGridItemLike): void {
    // Remove from source layout
    if (gridItem instanceof DashboardGridItem || gridItem instanceof AutoGridItem) {
      const layout = gridItem.parent;
      if (gridItem instanceof DashboardGridItem && layout instanceof SceneGridLayout) {
        const newChildren = layout.state.children.filter((child) => child !== gridItem);
        layout.setState({ children: newChildren });
      } else if (gridItem instanceof AutoGridItem && layout instanceof AutoGridLayout) {
        const newChildren = layout.state.children.filter((child) => child !== gridItem);
        layout.setState({ children: newChildren });
      } else {
        throw new Error('Grid item has unexpected parent type');
      }
    }
    this.setIsDropTarget(false);
  }

  public draggedGridItemInside(gridItem: SceneGridItemLike): void {
    const layout = this.getLayout();

    if (isDashboardLayoutGrid(layout)) {
      layout.addGridItem(gridItem);
    } else {
      throw new Error('Layout manager does not support addGridItem');
    }
    this.setIsDropTarget(false);

    const parentLayout = this.getParentLayout();
    if (parentLayout.state.currentTabSlug !== this.getSlug()) {
      parentLayout.setState({ currentTabSlug: this.getSlug() });
    }
  }

  public getParentLayout(): TabsLayoutManager {
    return sceneGraph.getAncestor(this, TabsLayoutManager);
  }

  public scrollIntoView(): void {
    const tabsLayout = this.getParentLayout();
    if (tabsLayout.getCurrentTab() !== this) {
      tabsLayout.switchToTab(this);
    }

    scrollCanvasElementIntoView(this, this.containerRef);
  }

  public hasUniqueTitle(): boolean {
    const parentLayout = this.getParentLayout();
    const duplicateTitles = parentLayout.duplicateTitles();
    return !duplicateTitles.has(this.state.title);
  }
}
