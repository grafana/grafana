import { isEqual } from 'lodash';
import { useEffect } from 'react';

import {
  MultiValueVariable,
  SceneVariableSet,
  LocalValueVariable,
  sceneGraph,
  VariableValueSingle,
} from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey, isClonedKeyOf } from '../../utils/clone';
import { dashboardLog, getMultiVariableValues } from '../../utils/utils';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

export interface Props {
  tab: TabItem;
  manager: TabsLayoutManager;
  variable: MultiValueVariable;
}

export function TabItemRepeater({
  tab,
  variable,
}: {
  tab: TabItem;
  manager: TabsLayoutManager;
  variable: MultiValueVariable;
}) {
  const { repeatedTabs } = tab.useState();

  // Subscribe to variable state changes and perform repeats when the variable changes
  useEffect(() => {
    performTabRepeats(variable, tab, false);

    const variableChangeSub = variable.subscribeToState((state) => performTabRepeats(variable, tab, false));
    const editEventSub = tab.subscribeToEvent(DashboardStateChangedEvent, (e) =>
      performTabRepeats(variable, tab, true)
    );

    return () => {
      editEventSub.unsubscribe();
      variableChangeSub.unsubscribe();
    };
  }, [variable, tab]);

  if (
    repeatedTabs === undefined ||
    sceneGraph.hasVariableDependencyInLoadingState(variable) ||
    variable.state.loading
  ) {
    dashboardLog.logger('TabItemRepeater', false, 'Variable is loading, showing spinner');
    return <Spinner />;
  }

  return (
    <>
      <tab.Component model={tab} key={tab.state.key!} />
      {repeatedTabs?.map((tabClone) => <tabClone.Component model={tabClone} key={tabClone.state.key!} />)}
    </>
  );
}

export function performTabRepeats(variable: MultiValueVariable, tab: TabItem, contentChanged: boolean) {
  if (sceneGraph.hasVariableDependencyInLoadingState(variable)) {
    dashboardLog.logger('TabItemRepeater', false, 'Skipped dependency in loading state');
    return;
  }

  if (variable.state.loading) {
    dashboardLog.logger('TabItemRepeater', false, 'Skipped, variable is loading');
    return;
  }

  const { values, texts } = getMultiVariableValues(variable);
  const prevValues = getPrevRepeatValues(tab, variable.state.name);

  if (!contentChanged && isEqual(prevValues, values)) {
    dashboardLog.logger('TabItemRepeater', false, 'Skipped, values the same');
    return;
  }

  if (contentChanged) {
    dashboardLog.logger('TabItemRepeater', false, 'Performing repeats, contentChanged');
  } else {
    dashboardLog.logger('TabItemRepeater', false, 'Performing repeats, variable values changed', values);
  }

  const variableValues = values.length ? values : [''];
  const variableTexts = texts.length ? texts : variable.hasAllValue() ? ['All'] : ['None'];
  const clonedTabs: TabItem[] = [];

  // Loop through variable values and create repeats
  for (let tabIndex = 0; tabIndex < variableValues.length; tabIndex++) {
    const isSourceTab = tabIndex === 0;
    const tabCloneKey = getCloneKey(tab.state.key!, tabIndex);
    const tabClone = isSourceTab
      ? tab
      : tab.clone({ repeatByVariable: undefined, repeatedTabs: undefined, layout: undefined });

    const layout = isSourceTab ? tab.getLayout() : tab.getLayout().cloneLayout(tabCloneKey, false);

    tabClone.setState({
      key: tabCloneKey,
      $variables: new SceneVariableSet({
        variables: [
          new LocalValueVariable({
            name: variable.state.name,
            value: variableValues[tabIndex],
            text: String(variableTexts[tabIndex]),
            isMulti: variable.state.isMulti,
            includeAll: variable.state.includeAll,
          }),
        ],
      }),
      layout,
    });

    if (!isSourceTab) {
      clonedTabs.push(tabClone);
    }
  }
  // updateLayout(tab.parent, clonedTabs, tab.state.key!);
  tab.setState({ repeatedTabs: clonedTabs });
  tab.publishEvent(new DashboardRepeatsProcessedEvent({ source: tab }), true);
}

/**
 * Get previous variable values given the current repeated state
 */
function getPrevRepeatValues(mainTab: TabItem, varName: string): VariableValueSingle[] {
  const values: VariableValueSingle[] = [];

  if (!mainTab.state.repeatedTabs) {
    return [];
  }

  function collectVariableValue(tab: TabItem) {
    const variable = sceneGraph.lookupVariable(varName, tab);
    if (variable) {
      const value = variable.getValue();
      if (value != null && !Array.isArray(value)) {
        values.push(value);
      }
    }
  }

  collectVariableValue(mainTab);

  for (const tab of mainTab.state.repeatedTabs) {
    collectVariableValue(tab);
  }

  return values;
}

function getTabsFilterOutRepeatClones(layout: TabsLayoutManager, tabKey: string) {
  return layout.state.tabs.filter((tab) => !isClonedKeyOf(tab.state.key!, tabKey));
}

function removeRepeatedTabs(layout: TabsLayoutManager, tab: TabItem) {
  // const tab = this._getTab();
  // const layout = this._getLayout();
  const tabs = getTabsFilterOutRepeatClones(layout, tab.state.key!);

  layout.setState({ tabs });

  // // Remove behavior and the scoped local variable
  // tab.setState({ $behaviors: tab.state.$behaviors!.filter((b) => b !== this), $variables: undefined });
}

function updateLayout(layout: TabsLayoutManager, tabs: TabItem[], tabKey: string) {
  const allTabs = getTabsFilterOutRepeatClones(layout, tabKey);
  const index = allTabs.findIndex((tab) => tab.state.key!.includes(tabKey));

  if (index === -1) {
    throw new Error('TabItemRepeaterBehavior: Tab not found in layout');
  }
  const newTabs = [...allTabs.slice(0, index + 1), ...tabs, ...allTabs.slice(index + 1)];

  console.log(
    allTabs.map((tab) => tab.state.title),
    index,
    newTabs.map((tab) => tab.state.title)
  );

  layout.setState({ tabs: newTabs });
}
