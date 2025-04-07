import { isEqual } from 'lodash';
import React from 'react';

import {
  CustomVariable,
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { scrollCanvasElementIntoView } from '../layouts-shared/scrollCanvasElementIntoView';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { getOptions } from './ResponsiveGridItemEditor';
import { AutoGridItemRenderer } from './ResponsiveGridItemRenderer';
import { AutoGridLayout } from './ResponsiveGridLayout';

export interface AutoGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
  repeatedPanels?: VizPanel[];
  variableName?: string;
  isHidden?: boolean;
  conditionalRendering?: ConditionalRendering;
}

export class AutoGridItem extends SceneObjectBase<AutoGridItemState> implements DashboardLayoutItem {
  public static Component = AutoGridItemRenderer;

  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: this.state.variableName ? [this.state.variableName] : [],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });

  public readonly isDashboardLayoutItem = true;
  public containerRef = React.createRef<HTMLDivElement>();
  private _prevRepeatValues?: VariableValueSingle[];

  public constructor(state: AutoGridItemState) {
    super({ ...state, conditionalRendering: state?.conditionalRendering ?? ConditionalRendering.createEmpty() });
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (this.state.variableName) {
      this.performRepeat();
    }

    const deactivate = this.state.conditionalRendering?.activate();

    return () => {
      if (deactivate) {
        deactivate();
      }
    };
  }

  public getOptions(): OptionsPaneCategoryDescriptor[] {
    return getOptions(this);
  }

  public setElementBody(body: VizPanel): void {
    this.setState({ body });
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
    for (let index = 0; index < variableValues.length; index++) {
      const cloneState: Partial<VizPanelState> = {
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: variable.state.name,
              value: variableValues[index],
              text: String(variableTexts[index]),
            }),
          ],
        }),
        key: getCloneKey(panelToRepeat.state.key!, index),
      };
      const clone = panelToRepeat.clone(cloneState);
      repeatedPanels.push(clone);
    }

    this.setState({ repeatedPanels });
    this._prevRepeatValues = values;

    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public setRepeatByVariable(variableName: string | undefined) {
    const stateUpdate: Partial<AutoGridItemState> = { variableName };

    if (this.state.body.state.$variables) {
      this.state.body.setState({ $variables: undefined });
    }

    this._variableDependency.setVariableNames(variableName ? [variableName] : []);

    this.setState(stateUpdate);
    this.performRepeat();
  }

  public getParentGrid(): AutoGridLayout {
    if (!(this.parent instanceof AutoGridLayout)) {
      throw new Error('Parent is not a ResponsiveGridLayout');
    }

    return this.parent;
  }

  public getBoundingBox(): { width: number; height: number; top: number; left: number } {
    const rect = this.containerRef.current!.getBoundingClientRect();

    return {
      width: rect.width,
      height: rect.height,
      top: this.containerRef.current!.offsetTop,
      left: this.containerRef.current!.offsetLeft,
    };
  }

  public scrollIntoView() {
    scrollCanvasElementIntoView(this, this.containerRef);
  }
}
