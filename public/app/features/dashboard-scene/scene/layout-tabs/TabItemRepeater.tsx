import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import {
  MultiValueVariable,
  SceneVariableSet,
  LocalValueVariable,
  sceneGraph,
  VariableValueSingle,
} from '@grafana/scenes';
import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey } from '../../utils/clone';
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
  const styles = useStyles2(getStyles);

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
    return (
      <Tooltip content={t('dashboard.tabs-layout.tab.repeat.loading', 'Loading tab repeats')}>
        <div className={styles.spinnerWrapper}>
          <Spinner />
        </div>
      </Tooltip>
    );
  }

  return (
    <>
      <tab.Component model={tab} key={tab.state.key!} />
      {repeatedTabs?.map((tabClone) => (
        <tabClone.Component model={tabClone} key={tabClone.state.key!} />
      ))}
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

  const clonedTabs = createTabRepeats({ values, texts, variable, tab });

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
      repeats.push(tabClone);
    }
  }
  return repeats;
}

const getStyles = () => ({
  spinnerWrapper: css({
    alignSelf: 'center',
  }),
});
