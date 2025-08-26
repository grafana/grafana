import React from 'react';

import { t } from '@grafana/i18n';
import {
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { RowsLayoutRowKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import appEvents from 'app/core/app_events';
import { LS_ROW_COPY_KEY } from 'app/core/constants';
import store from 'app/core/store';
import kbn from 'app/core/utils/kbn';
import { ShowConfirmModalEvent } from 'app/types/events';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { serializeRow } from '../../serialization/layoutSerializers/RowsLayoutSerializer';
import { getElements } from '../../serialization/layoutSerializers/utils';
import { getDashboardSceneFor } from '../../utils/utils';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { clearClipboard } from '../layouts-shared/paste';
import { scrollCanvasElementIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { BulkActionElement } from '../types/BulkActionElement';
import { DashboardDropTarget } from '../types/DashboardDropTarget';
import { DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../types/EditableDashboardElement';
import { LayoutParent } from '../types/LayoutParent';

import { useEditOptions } from './RowItemEditor';
import { RowItemRenderer } from './RowItemRenderer';
import { RowItems } from './RowItems';
import { RowsLayoutManager } from './RowsLayoutManager';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  collapse?: boolean;
  hideHeader?: boolean;
  fillScreen?: boolean;
  isDropTarget?: boolean;
  conditionalRendering?: ConditionalRendering;
  repeatByVariable?: string;
  repeatedRows?: RowItem[];
  /** Marks object as a repeated object and a key pointer to source object */
  repeatSourceKey?: string;
}

export class RowItem
  extends SceneObjectBase<RowItemState>
  implements LayoutParent, BulkActionElement, EditableDashboardElement, DashboardDropTarget
{
  public static Component = RowItemRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    statePaths: ['title'],
  });

  public readonly isEditableDashboardElement = true;
  public readonly isDashboardDropTarget = true;
  public containerRef: React.MutableRefObject<HTMLDivElement | null> = React.createRef<HTMLDivElement>();

  public constructor(state?: Partial<RowItemState>) {
    super({
      ...state,
      title: state?.title ?? t('dashboard.rows-layout.row.new', 'New row'),
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
      typeName: t('dashboard.edit-pane.elements.row', 'Row'),
      instanceName: sceneGraph.interpolate(this, this.state.title, undefined, 'text'),
      icon: 'list-ul',
    };
  }

  public getOutlineChildren(): SceneObject[] {
    return this.state.layout.getOutlineChildren();
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public getSlug(): string {
    return kbn.slugifyForUrl(sceneGraph.interpolate(this, this.state.title ?? 'Row'));
  }

  public switchLayout(layout: DashboardLayoutManager) {
    this.setState({ layout });
  }

  public useEditPaneOptions = useEditOptions.bind(this);

  public onDelete() {
    this.getParentLayout().removeRow(this);
  }

  public onConfirmDelete() {
    if (this.getLayout().getVizPanels().length === 0) {
      this.onDelete();
      return;
    }

    if (this.getParentLayout().shouldUngroup()) {
      this.onDelete();
      return;
    }

    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.rows-layout.delete-row-title', 'Delete row?'),
        text: t(
          'dashboard.rows-layout.delete-row-text',
          'Deleting this row will also remove all panels. Are you sure you want to continue?'
        ),
        yesText: t('dashboard.rows-layout.delete-row-yes', 'Delete'),
        onConfirm: () => {
          this.onDelete();
        },
      })
    );
  }

  public createMultiSelectedElement(items: SceneObject[]): RowItems {
    return new RowItems(items.filter((item) => item instanceof RowItem));
  }

  public onDuplicate() {
    this.getParentLayout().duplicateRow(this);
  }

  public duplicate(): RowItem {
    return this.clone({ key: undefined, layout: this.getLayout().duplicate() });
  }

  public serialize(): RowsLayoutRowKind {
    return serializeRow(this);
  }

  public onCopy() {
    const elements = getElements(this.getLayout(), getDashboardSceneFor(this));

    clearClipboard();
    store.set(LS_ROW_COPY_KEY, JSON.stringify({ elements, row: this.serialize() }));
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
  }

  public onChangeTitle(title: string) {
    this.setState({ title });
  }

  public onChangeName(name: string) {
    this.onChangeTitle(name);
  }

  public onHeaderHiddenToggle(hideHeader = !this.state.hideHeader) {
    this.setState({ hideHeader });
  }

  public onChangeFillScreen(fillScreen: boolean) {
    this.setState({ fillScreen });
  }

  public onChangeRepeat(repeat: string | undefined) {
    if (repeat) {
      this.setState({ repeatByVariable: repeat });
    } else {
      this.setState({ repeatedRows: undefined, $variables: undefined, repeatByVariable: undefined });
    }
  }

  public onCollapseToggle() {
    this.setState({ collapse: !this.state.collapse });
  }

  public getParentLayout(): RowsLayoutManager {
    return sceneGraph.getAncestor(this, RowsLayoutManager);
  }

  public scrollIntoView() {
    scrollCanvasElementIntoView(this, this.containerRef);
  }

  public getCollapsedState(): boolean {
    return this.state.collapse ?? false;
  }

  public setCollapsedState(collapse: boolean) {
    this.setState({ collapse });
  }

  public hasUniqueTitle(): boolean {
    const parentLayout = this.getParentLayout();
    const duplicateTitles = parentLayout.duplicateTitles();
    return !duplicateTitles.has(this.state.title);
  }
}
