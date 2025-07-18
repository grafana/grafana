import { isEqual } from 'lodash';

import {
  LocalValueVariable,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueSingle,
} from '@grafana/scenes';

import { isClonedKeyOf, getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

interface TabItemRepeaterBehaviorState extends SceneObjectState {
  variableName: string;
}

export class TabItemRepeaterBehavior extends SceneObjectBase<TabItemRepeaterBehaviorState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [this.state.variableName],
    onVariableUpdateCompleted: () => this.performRepeat(),
  });

  private _prevRepeatValues?: VariableValueSingle[];
  private _clonedTabs?: TabItem[];

  public constructor(state: TabItemRepeaterBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
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

  public performRepeat(force = false) {
    if (this._variableDependency.hasDependencyInLoadingState()) {
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

    const tabContent = tabToRepeat.getLayout();

    // when variable has no options (due to error or similar) it will not render any panels at all
    // adding a placeholder in this case so that there is at least empty panel that can display error
    const emptyVariablePlaceholderOption = {
      values: [''],
      texts: variable.hasAllValue() ? ['All'] : ['None'],
    };

    const variableValues = values.length ? values : emptyVariablePlaceholderOption.values;
    const variableTexts = texts.length ? texts : emptyVariablePlaceholderOption.texts;

    // Loop through variable values and create repeats
    for (let tabIndex = 0; tabIndex < variableValues.length; tabIndex++) {
      const isSourceTab = tabIndex === 0;
      const tabClone = isSourceTab ? tabToRepeat : tabToRepeat.clone({ $behaviors: [] });

      const tabCloneKey = getCloneKey(tabToRepeat.state.key!, tabIndex);

      tabClone.setState({
        key: tabCloneKey,
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: this.state.variableName,
              value: variableValues[tabIndex],
              text: String(variableTexts[tabIndex]),
              isMulti: variable.state.isMulti,
              includeAll: variable.state.includeAll,
            }),
          ],
        }),
        layout: tabContent.cloneLayout?.(tabCloneKey, isSourceTab),
      });

      this._clonedTabs.push(tabClone);
    }

    updateLayout(layout, this._clonedTabs, tabToRepeat.state.key!);

    // Used from dashboard url sync
    this.publishEvent(new DashboardRepeatsProcessedEvent({ source: this }), true);
  }

  public removeBehavior() {
    const tab = this._getTab();
    const layout = this._getLayout();
    const tabs = getTabsFilterOutRepeatClones(layout, tab.state.key!);

    layout.setState({ tabs });

    // Remove behavior and the scoped local variable
    tab.setState({ $behaviors: tab.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
  }
}

function updateLayout(layout: TabsLayoutManager, tabs: TabItem[], tabKey: string) {
  const allTabs = getTabsFilterOutRepeatClones(layout, tabKey);
  const index = allTabs.findIndex((tab) => tab.state.key!.includes(tabKey));

  if (index === -1) {
    throw new Error('TabItemRepeaterBehavior: Tab not found in layout');
  }

  layout.setState({ tabs: [...allTabs.slice(0, index), ...tabs, ...allTabs.slice(index + 1)] });
}

function getTabsFilterOutRepeatClones(layout: TabsLayoutManager, tabKey: string) {
  return layout.state.tabs.filter((tab) => !isClonedKeyOf(tab.state.key!, tabKey));
}
