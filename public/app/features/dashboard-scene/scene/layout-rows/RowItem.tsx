import { ReactNode } from 'react';

import { SceneObjectState, SceneObjectBase, sceneGraph, VariableDependencyConfig, SceneObject } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { getEditOptions, renderActions } from './RowItemEditor';
import { RowItemRenderer } from './RowItemRenderer';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
import { RowItems } from './RowItems';
import { RowsLayoutManager } from './RowsLayoutManager';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isCollapsed?: boolean;
  isHeaderHidden?: boolean;
  height?: 'expand' | 'min';
}

export class RowItem
  extends SceneObjectBase<RowItemState>
  implements LayoutParent, BulkActionElement, EditableDashboardElement
{
  public static Component = RowItemRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public readonly isEditableDashboardElement = true;

  public constructor(state?: Partial<RowItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.rows-layout.row.new', 'New row'),
      layout: state?.layout ?? ResponsiveGridLayoutManager.createEmpty(),
    });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return { typeId: 'row', icon: 'line-alt', name: sceneGraph.interpolate(this, this.state.title, undefined, 'text') };
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

  public onDelete() {
    const layout = sceneGraph.getAncestor(this, RowsLayoutManager);
    layout.removeRow(this);
  }

  public createMultiSelectedElement(items: SceneObject[]): RowItems {
    return new RowItems(items.filter((item) => item instanceof RowItem));
  }

  public getRepeatVariable(): string | undefined {
    return this._getRepeatBehavior()?.state.variableName;
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
  }

  public onHeaderHiddenToggle(isHeaderHidden = !this.state.isHeaderHidden) {
    this.setState({ isHeaderHidden });
  }

  public onChangeHeight(height: 'expand' | 'min') {
    this.setState({ height });
  }

  public onChangeRepeat(repeat: string | undefined) {
    let repeatBehavior = this._getRepeatBehavior();

    if (repeat) {
      // Remove repeat behavior if it exists to trigger repeat when adding new one
      if (repeatBehavior) {
        repeatBehavior.removeBehavior();
      }

      repeatBehavior = new RowItemRepeaterBehavior({ variableName: repeat });
      this.setState({ $behaviors: [...(this.state.$behaviors ?? []), repeatBehavior] });
      repeatBehavior.activate();
    } else {
      repeatBehavior?.removeBehavior();
    }
  }

  public onCollapseToggle() {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  }

  private _getRepeatBehavior(): RowItemRepeaterBehavior | undefined {
    return this.state.$behaviors?.find((b) => b instanceof RowItemRepeaterBehavior);
  }
}
