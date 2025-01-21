import { isEqual } from 'lodash';

import {
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
  VizPanelMenu,
} from '@grafana/scenes';

import { getMultiVariableValues, getQueryRunnerFor } from '../../utils/utils';
import { repeatPanelMenuBehavior } from '../PanelMenuBehavior';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';
import { getRepeatKeyForSceneObject, isRepeatedSceneObjectOf } from '../layouts-shared/repeatUtils';
import { DashboardRepeatsProcessedEvent } from '../types';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

interface TabItemRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

/**
 * This behavior will run an effect function when specified variables change
 */

export class TabItemRepeaterBehavior extends SceneObjectBase<TabItemRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => {},
  });

  public isWaitingForVariables = false;
  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedTabs?: TabItem[];

  public constructor(state: TabItemRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  public notifyRepeatedPanelsWaitingForVariables(variable: SceneVariable) {
    const allTabs = [this._getTab(), ...(this._clonedTabs ?? [])];

    for (const tab of allTabs) {
      const vizPanels = tab.getLayout().getVizPanels();

      for (const vizPanel of vizPanels) {
        const queryRunner = getQueryRunnerFor(vizPanel);
        if (queryRunner) {
          queryRunner.variableDependency?.variableUpdateCompleted(variable, false);
        }
      }
    }
  }

  private _activationHandler() {
    this.performRepeat();
  }

  private _getTab(): TabItem {
    if (!(this.parent instanceof TabItem)) {
      throw new Error('RepeatedTabItemBehavior: Parent is not a TabItem');
    }

    return this.parent;
  }

  private _getLayout(): TabsLayoutManager {
    const layout = this._getTab().parent;

    if (!(layout instanceof TabsLayoutManager)) {
      throw new Error('RepeatedTabItemBehavior: Layout is not a TabsLayoutManager');
    }

    return layout;
  }

  private _getTabClone(
    tabToRepeat: TabItem,
    index: number,
    value: VariableValueSingle,
    text: VariableValueSingle,
    variable: MultiValueVariable
  ): TabItem {
    const $variables = new SceneVariableSet({
      variables: [
        new LocalValueVariable({
          name: this.state.variableName,
          value,
          text: String(text),
          isMulti: variable.state.isMulti,
          includeAll: variable.state.includeAll,
        }),
      ],
    });

    const layout = tabToRepeat.getLayout().clone();

    if (layout instanceof DefaultGridLayoutManager) {
      layout.state.grid.setState({
        isDraggable: false,
      });

      layout.getVizPanels().forEach((panel) => {
        panel.setState({
          menu: new VizPanelMenu({
            $behaviors: [repeatPanelMenuBehavior],
          }),
        });
      });
    }

    if (index === 0) {
      tabToRepeat.setState({
        $variables,
        layout,
      });
      return tabToRepeat;
    }

    return tabToRepeat.clone({
      key: getRepeatKeyForSceneObject(tabToRepeat, value),
      $variables,
      $behaviors: [],
      layout,
      isClone: true,
    });
  }

  public performRepeat(force = false) {
    this.isWaitingForVariables = this._variableDependency.hasDependencyInLoadingState();

    if (this.isWaitingForVariables) {
      return;
    }

    const variable = sceneGraph.lookupVariable(this.state.variableName, this.parent?.parent!);

    if (!variable) {
      console.error('RepeatedTabItemBehavior: Variable not found');
      return;
    }

    if (!(variable instanceof MultiValueVariable)) {
      console.error('RepeatedTabItemBehavior: Variable is not a MultiValueVariable');
      return;
    }

    const tabToRepeat = this._getTab();
    const layout = this._getLayout();
    const { values, texts } = getMultiVariableValues(variable);

    // Do nothing if values are the same
    if (isEqual(this._prevRepeatValues, values) && !force) {
      return;
    }

    this._prevRepeatValues = values;

    this._clonedTabs = [];

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
      this._clonedTabs.push(
        this._getTabClone(tabToRepeat, index, variableValues[index], variableTexts[index], variable)
      );
    }

    updateLayout(layout, this._clonedTabs, tabToRepeat);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public removeBehavior() {
    const tab = this._getTab();
    const layout = this._getLayout();
    const tabs = getTabsFilterOutRepeatClones(layout, tab);

    layout.setState({ tabs });

    // Remove behavior and the scoped local variable
    tab.setState({ $behaviors: tab.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
  }
}

function updateLayout(layout: TabsLayoutManager, tabs: TabItem[], tabToRepeat: TabItem) {
  const allTabs = getTabsFilterOutRepeatClones(layout, tabToRepeat);
  const index = allTabs.indexOf(tabToRepeat);

  if (index === -1) {
    throw new Error('TabItemRepeaterBehavior: Tab not found in layout');
  }

  layout.setState({ tabs: [...allTabs.slice(0, index), ...tabs, ...allTabs.slice(index + 1)] });
}

function getTabsFilterOutRepeatClones(layout: TabsLayoutManager, tabToRepeat: TabItem) {
  return layout.state.tabs.filter((tab) => !isRepeatedSceneObjectOf(tab, tabToRepeat));
}
