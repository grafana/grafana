import { isEqual } from 'lodash';
import { useEffect } from 'react';

import {
  type MultiValueVariable,
  NewSceneObjectAddedEvent,
  SceneVariableSet,
  sceneGraph,
  type VariableValueSingle,
} from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey, getLocalVariableValueSet, getRepeatVariableValueSet } from '../../utils/clone';
import { getRepeatLocalVariableValue } from '../../utils/getRepeatLocalVariableValue';
import { dashboardLog, getMultiVariableValues } from '../../utils/utils';
import { filterSectionRepeatLocalVariables, getSectionBaseVariables } from '../../variables/utils';

import { type RowItem } from './RowItem';
import { type RowsLayoutManager } from './RowsLayoutManager';

export interface Props {
  row: RowItem;
  manager: RowsLayoutManager;
  variable: MultiValueVariable;
}

export function RowItemRepeater({
  row,
  variable,
}: {
  row: RowItem;
  manager: RowsLayoutManager;
  variable: MultiValueVariable;
}) {
  const { repeatedRows } = row.useState();

  // Subscribe to variable state changes and perform repeats when the variable changes
  useEffect(() => {
    performRowRepeats(variable, row, false);

    const variableChangeSub = variable.subscribeToState((state) => performRowRepeats(variable, row, false));
    const editEventSub = row.subscribeToEvent(DashboardStateChangedEvent, (e) =>
      performRowRepeats(variable, row, true)
    );

    return () => {
      editEventSub.unsubscribe();
      variableChangeSub.unsubscribe();
    };
  }, [variable, row]);

  if (
    repeatedRows === undefined ||
    sceneGraph.hasVariableDependencyInLoadingState(variable) ||
    variable.state.loading
  ) {
    dashboardLog.logger('RowItemRepeater', false, 'Variable is loading, showing spinner');
    return <Spinner />;
  }

  return (
    <>
      <row.Component model={row} key={row.state.key!} />
      {repeatedRows?.map((rowClone) => (
        <rowClone.Component model={rowClone} key={rowClone.state.key!} />
      ))}
    </>
  );
}

export function performRowRepeats(variable: MultiValueVariable, row: RowItem, contentChanged: boolean) {
  if (sceneGraph.hasVariableDependencyInLoadingState(variable)) {
    dashboardLog.logger('RowItemRepeater', false, 'Skipped dependency in loading state');
    return;
  }

  if (variable.state.loading) {
    dashboardLog.logger('RowItemRepeater', false, 'Skipped, variable is loading');
    return;
  }

  const { values, texts } = getMultiVariableValues(variable);
  const prevValues = getPrevRepeatValues(row, variable.state.name);

  if (!contentChanged && isEqual(prevValues, values)) {
    dashboardLog.logger('RowItemRepeater', false, 'Skipped, values the same');
    return;
  }

  if (contentChanged) {
    dashboardLog.logger('RowItemRepeater', false, 'Performing repeats, contentChanged');
  } else {
    dashboardLog.logger('RowItemRepeater', false, 'Performing repeats, variable values changed', values);
  }

  const variableValues = values.length ? values : [''];
  const variableTexts = texts.length ? texts : variable.hasAllValue() ? ['All'] : ['None'];
  const clonedRows: RowItem[] = [];
  const baseSectionVariables = getSectionBaseVariables(row);

  // Loop through variable values and create repeats
  for (let rowIndex = 0; rowIndex < variableValues.length; rowIndex++) {
    const isSourceRow = rowIndex === 0;
    const rowCloneKey = getCloneKey(row.state.key!, rowIndex);
    const rowClone = isSourceRow
      ? row
      : row.clone({
          key: rowCloneKey,
          repeatSourceKey: row.state.key,
          repeatByVariable: undefined,
          repeatedRows: undefined,
          layout: undefined,
        });

    const layout = isSourceRow ? row.getLayout() : row.getLayout().cloneLayout(rowCloneKey, false);
    const sourceVariables = row.state.$variables;
    const localSet = getLocalVariableValueSet(variable, variableValues[rowIndex], variableTexts[rowIndex]);
    const localVariables = localSet.state.variables.map((v) => v.clone());
    let repeatedVariableSet: SceneVariableSet;
    // First iteration reuses the original row and updates its variable set in place.
    // Cloned rows must get an isolated variable set so each repeat keeps its own selected value/text.
    if (isSourceRow && sourceVariables instanceof SceneVariableSet) {
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
        variableValues[rowIndex],
        variableTexts[rowIndex],
        baseSectionVariables
      );
    }

    rowClone.setState({
      $variables: repeatedVariableSet,
      layout,
    });

    if (!isSourceRow) {
      rowClone.state.conditionalRendering?.setTarget(rowClone);
      clonedRows.push(rowClone);
    } else {
      row.state.conditionalRendering?.setTarget(row);
    }
  }

  row.setState({ repeatedRows: clonedRows });
  // Rehydrate from a stable parent subtree to keep duplicate var-* key mapping consistent.
  row.publishEvent(new NewSceneObjectAddedEvent(row.parent ?? row), true);
}

/**
 * Get previous variable values given the current repeated state
 */
function getPrevRepeatValues(mainRow: RowItem, varName: string): VariableValueSingle[] | undefined {
  const values: VariableValueSingle[] = [];

  if (!mainRow.state.repeatedRows) {
    return undefined;
  }

  function collectVariableValue(row: RowItem) {
    const value = getRepeatLocalVariableValue(row, varName);
    if (value != null && !Array.isArray(value)) {
      values.push(value);
    }
  }

  collectVariableValue(mainRow);

  for (const row of mainRow.state.repeatedRows) {
    collectVariableValue(row);
  }

  return values;
}
