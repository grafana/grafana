import { isEqual } from 'lodash';
import React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  VizPanel,
  SceneObjectBase,
  SceneGridLayout,
  SceneVariableSet,
  SceneGridItemStateLike,
  SceneGridItemLike,
  sceneGraph,
  MultiValueVariable,
  LocalValueVariable,
  CustomVariable,
  VizPanelState,
  VariableValueSingle,
} from '@grafana/scenes';
import { GRID_COLUMN_COUNT } from 'app/core/constants';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { scrollCanvasElementIntoView, scrollIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { getDashboardGridItemOptions } from './DashboardGridItemEditor';
import { DashboardGridItemRenderer } from './DashboardGridItemRenderer';
import { DashboardGridItemVariableDependencyHandler } from './DashboardGridItemVariableDependencyHandler';

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

    const itemCount = this.state.repeatedPanels?.length ?? 1;
    const stateChange: Partial<DashboardGridItemState> = {};

    if (this.getRepeatDirection() === 'v') {
      stateChange.itemHeight = Math.ceil(newState.height! / itemCount);
    } else {
      const rowCount = Math.ceil(itemCount / this.getMaxPerRow());
      stateChange.itemHeight = Math.ceil(newState.height! / rowCount);
    }

    if (stateChange.itemHeight !== this.state.itemHeight) {
      this.setState(stateChange);
    }
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

  public editingStarted() {
    if (!this.state.variableName) {
      return;
    }

    if (this.state.repeatedPanels?.length ?? 0 > 1) {
      this.state.body.setState({
        $variables: this.state.repeatedPanels![0].state.$variables?.clone(),
        $data: this.state.repeatedPanels![0].state.$data?.clone(),
      });
    }
  }

  public editingCompleted(withChanges: boolean) {
    if (withChanges) {
      this._prevRepeatValues = undefined;
    }

    if (this.state.variableName && this.state.repeatDirection === 'h' && this.state.width !== GRID_COLUMN_COUNT) {
      this.setState({ width: GRID_COLUMN_COUNT });
    }
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
      const cloneState: Partial<VizPanelState> = {
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: variable.state.name,
              value: variableValues[index],
              text: String(variableTexts[index]),
              isMulti: variable.state.isMulti,
              includeAll: variable.state.includeAll,
            }),
          ],
        }),
        key: getCloneKey(panelToRepeat.state.key!, index),
      };
      const clone = panelToRepeat.clone(cloneState);
      repeatedPanels.push(clone);
    }

    const direction = this.getRepeatDirection();
    const stateChange: Partial<DashboardGridItemState> = { repeatedPanels: repeatedPanels };
    const itemHeight = this.state.itemHeight ?? 10;
    const prevHeight = this.state.height;
    const maxPerRow = this.getMaxPerRow();

    if (direction === 'h') {
      const rowCount = Math.ceil(repeatedPanels.length / maxPerRow);
      stateChange.height = rowCount * itemHeight;
    } else {
      stateChange.height = repeatedPanels.length * itemHeight;
    }

    this.setState(stateChange);

    if (prevHeight !== this.state.height) {
      const layout = sceneGraph.getLayout(this);
      if (layout instanceof SceneGridLayout) {
        layout.forceRender();
      }
    }

    this._prevRepeatValues = values;

    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
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
