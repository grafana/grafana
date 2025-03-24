import { sceneGraph, SceneObject, SceneObjectBase, SceneObjectState, VariableDependencyConfig } from '@grafana/scenes';
import { t } from 'app/core/internationalization';
import kbn from 'app/core/utils/kbn';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { getDefaultVizPanel } from '../../utils/utils';
import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { LayoutRestorer } from '../layouts-shared/LayoutRestorer';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { getEditOptions } from './RowItemEditor';
import { RowItemRenderer } from './RowItemRenderer';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
import { RowItems } from './RowItems';
import { RowsLayoutManager } from './RowsLayoutManager';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isCollapsed?: boolean;
  isHeaderHidden?: boolean;
  fillScreen?: boolean;
  conditionalRendering?: ConditionalRendering;
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
  private _layoutRestorer = new LayoutRestorer();

  public constructor(state?: Partial<RowItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.rows-layout.row.new', 'New row'),
      layout: state?.layout ?? ResponsiveGridLayoutManager.createEmpty(),
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
      typeName: t('dashboard.edit-pane.elements.row', 'Row'),
      instanceName: sceneGraph.interpolate(this, this.state.title, undefined, 'text'),
      icon: 'line-alt',
    };
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public getSlug(): string {
    return kbn.slugifyForUrl(sceneGraph.interpolate(this, this.state.title ?? 'Row'));
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ layout: this._layoutRestorer.getLayout(layout, this.state.layout) });
  }

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    return getEditOptions(this);
  }

  public onDelete() {
    this._getParentLayout().removeRow(this);
  }

  public createMultiSelectedElement(items: SceneObject[]): RowItems {
    return new RowItems(items.filter((item) => item instanceof RowItem));
  }

  public onDuplicate() {
    this._getParentLayout().duplicateRow(this);
  }

  public duplicate(): RowItem {
    return this.clone({ key: undefined, layout: this.getLayout().duplicate() });
  }

  public onAddPanel(panel = getDefaultVizPanel()) {
    this.getLayout().addPanel(panel);
  }

  public onAddRowAbove() {
    this._getParentLayout().addRowAbove(this);
  }

  public onAddRowBelow() {
    this._getParentLayout().addRowBelow(this);
  }

  public onMoveUp() {
    this._getParentLayout().moveRowUp(this);
  }

  public onMoveDown() {
    this._getParentLayout().moveRowDown(this);
  }

  public isFirstRow(): boolean {
    return this._getParentLayout().isFirstRow(this);
  }

  public isLastRow(): boolean {
    return this._getParentLayout().isLastRow(this);
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

  public onChangeFillScreen(fillScreen: boolean) {
    this.setState({ fillScreen });
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

  private _getParentLayout(): RowsLayoutManager {
    return sceneGraph.getAncestor(this, RowsLayoutManager);
  }

  private _getRepeatBehavior(): RowItemRepeaterBehavior | undefined {
    return this.state.$behaviors?.find((b) => b instanceof RowItemRepeaterBehavior);
  }
}
