import { SceneObjectState, SceneObjectBase, sceneGraph, VariableDependencyConfig, SceneObject } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { getDefaultVizPanel } from '../../utils/utils';
import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { getEditOptions } from './TabItemEditor';
import { TabItemRenderer } from './TabItemRenderer';
import { TabItems } from './TabItems';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface TabItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
}

export class TabItem
  extends SceneObjectBase<TabItemState>
  implements LayoutParent, BulkActionElement, EditableDashboardElement
{
  public static Component = TabItemRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public readonly isEditableDashboardElement = true;
  public readonly typeName = 'Tab';

  constructor(state?: Partial<TabItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.tabs-layout.tab.new', 'New tab'),
      layout: state?.layout ?? ResponsiveGridLayoutManager.createEmpty(),
    });

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this._subs.add(
      this._getParentLayout().subscribeToState((newState, prevState) => {
        if (newState.tabs !== prevState.tabs || newState.currentTab !== prevState.currentTab) {
          this.forceRender();
        }
      })
    );
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ layout });
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public onDelete = () => {
    const layout = sceneGraph.getAncestor(this, TabsLayoutManager);
    layout.removeTab(this);
  };

  public createMultiSelectedElement(items: SceneObject[]): TabItems {
    return new TabItems(items.filter((item) => item instanceof TabItem));
  }

  public onAddPanel(panel = getDefaultVizPanel()) {
    this.getLayout().addPanel(panel);
  }

  public onAddTabBefore = () => {
    this._getParentLayout().addTabBefore(this);
  };

  public onAddTabAfter = () => {
    this._getParentLayout().addTabAfter(this);
  };

  public onMoveLeft() {
    this._getParentLayout().moveTabLeft(this);
  }

  public onMoveRight() {
    this._getParentLayout().moveTabRight(this);
  }

  public isCurrentTab(): boolean {
    return this._getParentLayout().isCurrentTab(this);
  }

  public isFirstTab(): boolean {
    return this._getParentLayout().isFirstTab(this);
  }

  public isLastTab(): boolean {
    return this._getParentLayout().isLastTab(this);
  }

  public onChangeTab() {
    this._getParentLayout().changeTab(this);
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
  }

  private _getParentLayout(): TabsLayoutManager {
    return sceneGraph.getAncestor(this, TabsLayoutManager);
  }
}
