import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import {
  type MultiValueVariable,
  NewSceneObjectAddedEvent,
  SceneVariableSet,
  sceneGraph,
  type VariableValueSingle,
} from '@grafana/scenes';
import { Spinner, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey, getLocalVariableValueSet, getRepeatVariableValueSet } from '../../utils/clone';
import { getRepeatLocalVariableValue } from '../../utils/getRepeatLocalVariableValue';
import { dashboardLog, getMultiVariableValues } from '../../utils/utils';
import { filterSectionRepeatLocalVariables, getSectionBaseVariables } from '../../variables/utils';

import { type TabItem } from './TabItem';
import { type TabsLayoutManager } from './TabsLayoutManager';

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
  // Rehydrate from a stable parent subtree to keep duplicate var-* key mapping consistent.
  tab.publishEvent(new NewSceneObjectAddedEvent(tab.parent ?? tab), true);
  tab.parent?.forceRender();
}

/**
 * Get previous variable values given the current repeated state
 */
function getPrevRepeatValues(mainTab: TabItem, varName: string): VariableValueSingle[] | undefined {
  const values: VariableValueSingle[] = [];

  if (!mainTab.state.repeatedTabs) {
    return undefined;
  }

  function collectVariableValue(tab: TabItem) {
    const value = getRepeatLocalVariableValue(tab, varName);
    if (value != null && !Array.isArray(value)) {
      values.push(value);
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
  const baseSectionVariables = getSectionBaseVariables(tab);

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
    const sourceVariables = tab.state.$variables;
    const localSet = getLocalVariableValueSet(variable, variableValues[tabIndex], variableTexts[tabIndex]);
    const localVariables = localSet.state.variables.map((v) => v.clone());
    let repeatedVariableSet: SceneVariableSet;
    if (isSourceTab && sourceVariables instanceof SceneVariableSet) {
      sourceVariables.setState({
        variables: [
          ...filterSectionRepeatLocalVariables(sourceVariables.state.variables, sourceVariables),
          ...localVariables,
        ],
      });
      repeatedVariableSet = sourceVariables;
    } else {
      repeatedVariableSet = getRepeatVariableValueSet(
        variable,
        variableValues[tabIndex],
        variableTexts[tabIndex],
        baseSectionVariables
      );
    }

    tabClone.setState({
      $variables: repeatedVariableSet,
      layout,
    });

    if (!isSourceTab) {
      tabClone.state.conditionalRendering?.setTarget(tabClone);
      repeats.push(tabClone);
    } else {
      tab.state.conditionalRendering?.setTarget(tab);
    }
  }
  return repeats;
}

const getStyles = () => ({
  spinnerWrapper: css({
    alignSelf: 'center',
  }),
});
