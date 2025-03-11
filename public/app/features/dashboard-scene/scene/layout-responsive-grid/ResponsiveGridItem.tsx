import { isEqual } from 'lodash';

import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  sceneGraph,
  CustomVariable,
  MultiValueVariable,
  VariableValueSingle,
  VizPanelState,
  SceneVariableSet,
  LocalValueVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';

import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { DashboardLayoutItem } from '../types/DashboardLayoutItem';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { getOptions } from './ResponsiveGridItemEditor';
import { ResponsiveGridItemRenderer } from './ResponsiveGridItemRenderer';

export interface ResponsiveGridItemState extends SceneObjectState {
  body: VizPanel;
  hideWhenNoData?: boolean;
  repeatedPanels?: VizPanel[];
  variableName?: string;
}

export class ResponsiveGridItem extends SceneObjectBase<ResponsiveGridItemState> implements DashboardLayoutItem {
  public static Component = ResponsiveGridItemRenderer;
  private _prevRepeatValues?: VariableValueSingle[];
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: this.state.variableName ? [this.state.variableName] : [],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });
  public readonly isDashboardLayoutItem = true;

  public constructor(state: ResponsiveGridItemState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (this.state.variableName) {
      this.performRepeat();
    }
  }

  public getOptions(): OptionsPaneCategoryDescriptor {
    return getOptions(this);
  }

  public toggleHideWhenNoData() {
    this.setState({ hideWhenNoData: !this.state.hideWhenNoData });
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
    const stateUpdate: Partial<ResponsiveGridItemState> = { variableName };

    if (this.state.body.state.$variables) {
      this.state.body.setState({ $variables: undefined });
    }

    this._variableDependency.setVariableNames(variableName ? [variableName] : []);

    this.setState(stateUpdate);
    this.performRepeat();
  }
}
