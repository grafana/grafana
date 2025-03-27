import {
  SceneObjectState,
  SceneObjectBase,
  sceneGraph,
  VariableDependencyConfig,
  SceneObject,
  VizPanel,
} from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import kbn from 'app/core/utils/kbn';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { getDefaultVizPanel } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { LayoutRestorer } from '../layouts-shared/LayoutRestorer';
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
  isDropTarget?: boolean;
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

  constructor(state?: Partial<TabItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.tabs-layout.tab.new', 'New tab'),
      layout: state?.layout ?? AutoGridLayoutManager.createEmpty(),
    });
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

  public createMultiSelectedElement(items: SceneObject[]): TabItems {
    return new TabItems(items.filter((item) => item instanceof TabItem));
  }

  public onDuplicate(): void {
    this._getParentLayout().duplicateTab(this);
  }

  public duplicate(): TabItem {
    return this.clone({ key: undefined, layout: this.getLayout().duplicate() });
  }

  public onAddPanel(panel = getDefaultVizPanel()) {
    this.getLayout().addPanel(panel);
  }

  public onAddTabBefore() {
    this._getParentLayout().addTabBefore(this);
  }

  public onAddTabAfter() {
    this._getParentLayout().addTabAfter(this);
  }

  public onMoveLeft() {
    this._getParentLayout().moveTabLeft(this);
  }

  public onMoveRight() {
    this._getParentLayout().moveTabRight(this);
  }

  public isFirstTab(): boolean {
    return this._getParentLayout().isFirstTab(this);
  }

  public isLastTab(): boolean {
    return this._getParentLayout().isLastTab(this);
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
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
    return this._getParentLayout();
  }

  private _getParentLayout(): TabsLayoutManager {
    return sceneGraph.getAncestor(this, TabsLayoutManager);
  }
}
