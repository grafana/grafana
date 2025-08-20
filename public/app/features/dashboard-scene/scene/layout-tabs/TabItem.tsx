import React from 'react';

import { t } from '@grafana/i18n';
import {
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  VariableDependencyConfig,
  SceneObject,
  VizPanel,
} from '@grafana/scenes';
import { TabsLayoutTabKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { LS_TAB_COPY_KEY } from 'app/core/constants';
import { appEvents } from 'app/core/core';
import store from 'app/core/store';
import kbn from 'app/core/utils/kbn';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { serializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { getElements } from '../../serialization/layoutSerializers/utils';
import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { clearClipboard } from '../layouts-shared/paste';
import { scrollCanvasElementIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardDropTarget } from '../types/DashboardDropTarget';
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
  conditionalRendering?: ConditionalRendering;
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
      conditionalRendering: state?.conditionalRendering ?? ConditionalRendering.createEmpty(),
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

  public useEditPaneOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    return useEditOptions(this, isNewElement);
  }

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

  public onAddPanel(panel = getDefaultVizPanel()) {
    this.getLayout().addPanel(panel);
  }

  public onAddTab() {
    this.getParentLayout().addNewTab();
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
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

  public draggedPanelOutside(panel: VizPanel) {
    this.getLayout().removePanel?.(panel);
    this.setIsDropTarget(false);
  }

  public draggedPanelInside(panel: VizPanel) {
    panel.clearParent();
    this.getLayout().addPanel(panel);
    this.setIsDropTarget(false);

    const parentLayout = this.getParentLayout();
    const tabIndex = parentLayout.state.tabs.findIndex((tab) => tab === this);
    if (tabIndex !== parentLayout.state.currentTabIndex) {
      parentLayout.setState({ currentTabIndex: tabIndex });
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
