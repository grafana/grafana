import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  VariableDependencyConfig,
  SceneObject,
  VizPanel,
} from '@grafana/scenes';
import { TabsLayoutTabKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha1/types.spec.gen';
import { LS_TAB_COPY_KEY } from 'app/core/constants';
import { t } from 'app/core/internationalization';
import store from 'app/core/store';
import kbn from 'app/core/utils/kbn';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { serializeTab } from '../../serialization/layoutSerializers/TabsLayoutSerializer';
import { getElements } from '../../serialization/layoutSerializers/utils';
import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { LayoutRestorer } from '../layouts-shared/LayoutRestorer';
import { clearClipboard } from '../layouts-shared/paste';
import { scrollCanvasElementIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardDropTarget } from '../types/DashboardDropTarget';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { getEditOptions } from './TabItemEditor';
import { TabItemRenderer } from './TabItemRenderer';
import { TabItems } from './TabItems';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface TabItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  /**
   * Used to auto focus the title input
   */
  isNew?: boolean;
  isDropTarget?: boolean;
  conditionalRendering?: ConditionalRendering;
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

  private _layoutRestorer = new LayoutRestorer();
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

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public getSlug(): string {
    return kbn.slugifyForUrl(sceneGraph.interpolate(this, this.state.title ?? 'Tab'));
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ layout: this._layoutRestorer.getLayout(layout, this.state.layout) });
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public onDelete() {
    const layout = sceneGraph.getAncestor(this, TabsLayoutManager);
    layout.removeTab(this);
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
    this.setState({ title, isNew: false });
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
