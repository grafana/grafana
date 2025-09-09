import { isEqual } from 'lodash';
import React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  VizPanel,
  SceneObjectBase,
  SceneGridLayout,
  SceneGridItemStateLike,
  SceneGridItemLike,
  sceneGraph,
  MultiValueVariable,
  CustomVariable,
  VariableValueSingle,
  SceneGridRow,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey, getLocalVariableValueSet } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { scrollCanvasElementIntoView, scrollIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';

import { getDashboardGridItemOptions } from './DashboardGridItemEditor';
import { DashboardGridItemRenderer } from './DashboardGridItemRenderer';
import { DashboardGridItemVariableDependencyHandler } from './DashboardGridItemVariableDependencyHandler';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';

export interface DashboardGridItemState extends SceneGridItemStateLike {
  body: VizPanel;
  repeatedPanels?: VizPanel[];
  variableName?: string;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
  maxPerRow?: number;
}

export type RepeatDirection = 'v' | 'h';

export class DashboardGridItem
  extends SceneObjectBase<DashboardGridItemState>
  implements SceneGridItemLike, DashboardLayoutItem
{
  public static Component = DashboardGridItemRenderer;

  protected _variableDependency = new DashboardGridItemVariableDependencyHandler(this);

  public readonly isDashboardLayoutItem = true;
  public containerRef = React.createRef<HTMLDivElement>();

  private _prevRepeatValues?: VariableValueSingle[];
  private _gridSizeSub: Unsubscribable | undefined;

  public constructor(state: DashboardGridItemState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    this.handleVariableName();

    this._subs.add(this.subscribeToEvent(DashboardStateChangedEvent, () => this.handleEditChange()));

    return () => {
      this._handleGridSizeUnsubscribe();
    };
  }

  private _handleGridSizeSubscribe() {
    if (!this._gridSizeSub) {
      this._gridSizeSub = this.subscribeToState((newState, prevState) => this._handleGridResize(newState, prevState));
    }
  }

  private _handleGridSizeUnsubscribe() {
    if (this._gridSizeSub) {
      this._gridSizeSub.unsubscribe();
      this._gridSizeSub = undefined;
    }
  }

  private _handleGridResize(newState: DashboardGridItemState, prevState: DashboardGridItemState) {
    if (newState.height === prevState.height) {
      return;
    }

    const stateChange: Partial<DashboardGridItemState> = {};

    if (this.getRepeatDirection() === 'v') {
      stateChange.itemHeight = Math.ceil(newState.height! / this.getChildCount());
    } else {
      const rowCount = Math.ceil(this.getChildCount() / this.getMaxPerRow());
      stateChange.itemHeight = Math.ceil(newState.height! / rowCount);
    }

    if (stateChange.itemHeight !== this.state.itemHeight) {
      this.setState(stateChange);
    }
  }

  public getChildCount() {
    return (this.state.repeatedPanels?.length ?? 0) + 1;
  }

  public getClassName(): string {
    return this.state.variableName ? 'panel-repeater-grid-item' : '';
  }

  public getOptions(): OptionsPaneCategoryDescriptor[] {
    return getDashboardGridItemOptions(this);
  }

  public setElementBody(body: VizPanel): void {
    this.setState({ body });
  }

  public handleEditChange() {
    this._prevRepeatValues = undefined;

    if (this.parent instanceof SceneGridRow) {
      const repeater = this.parent.state.$behaviors?.find((b) => b instanceof RowRepeaterBehavior);
      if (repeater) {
        repeater.resetPrevRepeatValues();
      }
    }

    if (this.state.variableName && this.state.repeatDirection === 'h' && this.state.width !== GRID_COLUMN_COUNT) {
      this.setState({ width: GRID_COLUMN_COUNT });
    }

    this.performRepeat();
  }

  public performRepeat() {
    if (!this.state.variableName || sceneGraph.hasVariableDependencyInLoadingState(this)) {
      return;
    }

    const variable =
      sceneGraph.lookupVariable(this.state.variableName, this) ??
      new CustomVariable({
        name: '_____default_sys_repeat_var_____',
        options: [],
        value: '',
        text: '',
        query: 'A',
      });

    if (!(variable instanceof MultiValueVariable)) {
      console.error('DashboardGridItem: Variable is not a MultiValueVariable');
      return;
    }

    const { values, texts } = getMultiVariableValues(variable);

    if (isEqual(this._prevRepeatValues, values)) {
      return;
    }

    const panelToRepeat = this.state.body;
    const repeatedPanels: VizPanel[] = [];

    // when variable has no options (due to error or similar) it will not render any panels at all
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeats
    for (let index = 0; index < variableValues.length; index++) {
      const isSource = index === 0;
      const clone = isSource
        ? panelToRepeat
        : panelToRepeat.clone({
            key: getCloneKey(panelToRepeat.state.key!, index),
            repeatSourceKey: panelToRepeat.state.key,
          });

      clone.setState({ $variables: getLocalVariableValueSet(variable, variableValues[index], variableTexts[index]) });

      if (index > 0) {
        repeatedPanels.push(clone);
      }
    }

    const direction = this.getRepeatDirection();
    const stateChange: Partial<DashboardGridItemState> = { repeatedPanels: repeatedPanels };
    const itemHeight = this.state.itemHeight ?? 10;
    const prevHeight = this.state.height;
    const maxPerRow = this.getMaxPerRow();
    const panelCount = repeatedPanels.length + 1; // +1 for the source panel

    if (direction === 'h') {
      const rowCount = Math.ceil(panelCount / maxPerRow);
      stateChange.height = rowCount * itemHeight;
    } else {
      stateChange.height = panelCount * itemHeight;
    }

    this.setState(stateChange);

    if (prevHeight !== this.state.height) {
      const layout = sceneGraph.getLayout(this);
      if (layout instanceof SceneGridLayout) {
        layout.forceRender();
      }
    }

    this._prevRepeatValues = values;
  }

  public handleVariableName() {
    if (this.state.variableName) {
      this._handleGridSizeSubscribe();
    } else {
      this._handleGridSizeUnsubscribe();
    }

    this.performRepeat();
  }

  public setRepeatByVariable(variableName: string | undefined) {
    const stateUpdate: Partial<DashboardGridItemState> = { variableName };

    if (variableName && !this.state.repeatDirection) {
      stateUpdate.repeatDirection = 'h';
    }

    if (this.state.body.state.$variables) {
      this.state.body.setState({ $variables: undefined });
    }

    this.setState(stateUpdate);
  }

  public getMaxPerRow(): number {
    return this.state.maxPerRow ?? 4;
  }

  public setMaxPerRow(maxPerRow: number | undefined) {
    this.setState({ maxPerRow });
  }

  public getRepeatDirection(): RepeatDirection {
    return this.state.repeatDirection === 'v' ? 'v' : 'h';
  }

  public setRepeatDirection(repeatDirection: RepeatDirection) {
    this.setState({ repeatDirection });
  }

  public isRepeated(): boolean {
    return this.state.variableName !== undefined;
  }

  public scrollIntoView() {
    const gridItemEl = document.querySelector(`[data-griditem-key="${this.state.key}"`);
    if (gridItemEl instanceof HTMLElement) {
      scrollIntoView(gridItemEl);
    } else {
      scrollCanvasElementIntoView(this, this.containerRef);
    }
  }
}
