import { ReactNode } from 'react';

import { SceneObjectState, SceneObjectBase, sceneGraph, VariableDependencyConfig, SceneObject } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { getEditOptions, renderActions } from './TabItemEditor';
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

  constructor(state?: Partial<TabItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.tabs-layout.tab.new', 'New tab'),
      layout: state?.layout ?? ResponsiveGridLayoutManager.createEmpty(),
    });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeId: 'tab', icon: 'tag-alt', name: sceneGraph.interpolate(this, this.state.title, undefined, 'text') };
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

  public renderActions(): ReactNode {
    return renderActions(this);
  }

  public getParentLayout(): TabsLayoutManager {
    return sceneGraph.getAncestor(this, TabsLayoutManager);
  }

  public onDelete() {
    const layout = sceneGraph.getAncestor(this, TabsLayoutManager);
    layout.removeTab(this);
  }

  public createMultiSelectedElement(items: SceneObject[]): TabItems {
    return new TabItems(items.filter((item) => item instanceof TabItem));
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
  }
}
