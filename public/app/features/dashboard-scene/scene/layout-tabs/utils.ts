import { isEqual } from 'lodash';

import { MultiValueVariable, sceneGraph, VariableValueSingle } from '@grafana/scenes';

import { getCloneKey, getLocalVariableValueSet } from '../../utils/clone';
import { dashboardLog, getMultiVariableValues } from '../../utils/utils';

import { TabItem } from './TabItem';

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

  const clonedTabs = createTabRepeats({ values, texts, variable, tab });

  tab.setState({ repeatedTabs: clonedTabs });
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

export function createTabRepeats({
  values,
  texts,
  variable,
  tab,
}: {
  values: VariableValueSingle[];
  texts: VariableValueSingle[];
  variable: MultiValueVariable;
  tab: TabItem;
}) {
  const variableValues = values.length ? values : [''];
  const variableTexts = texts.length ? texts : variable.hasAllValue() ? ['All'] : ['None'];
  const repeats: TabItem[] = [];

  // Loop through variable values and create repeats
  for (let tabIndex = 0; tabIndex < variableValues.length; tabIndex++) {
    const isSourceTab = tabIndex === 0;
    const tabCloneKey = getCloneKey(tab.state.key!, tabIndex);
    const tabClone = isSourceTab
      ? tab
      : tab.clone({
          key: tabCloneKey,
          repeatSourceKey: tab.state.key,
          repeatByVariable: undefined,
          repeatedTabs: undefined,
          layout: undefined,
        });

    const layout = isSourceTab ? tab.getLayout() : tab.getLayout().cloneLayout(tabCloneKey, false);

    tabClone.setState({
      $variables: getLocalVariableValueSet(variable, variableValues[tabIndex], variableTexts[tabIndex]),
      layout,
    });

    if (!isSourceTab) {
      repeats.push(tabClone);
    }
  }
  return repeats;
}
