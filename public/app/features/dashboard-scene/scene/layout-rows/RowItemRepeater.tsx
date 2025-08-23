import { isEqual } from 'lodash';
import { useEffect } from 'react';

import { MultiValueVariable, sceneGraph, VariableValueSingle } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { DashboardStateChangedEvent } from '../../edit-pane/shared';
import { getCloneKey, getLocalVariableValueSet } from '../../utils/clone';
import { dashboardLog, getMultiVariableValues } from '../../utils/utils';
import { DashboardRepeatsProcessedEvent } from '../types/DashboardRepeatsProcessedEvent';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

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

    rowClone.setState({
      $variables: getLocalVariableValueSet(variable, variableValues[rowIndex], variableTexts[rowIndex]),
      layout,
    });

    if (!isSourceRow) {
      clonedRows.push(rowClone);
    }
  }

  row.setState({ repeatedRows: clonedRows });
  row.publishEvent(new DashboardRepeatsProcessedEvent({ source: row }), true);
}

/**
 * Get previous variable values given the current repeated state
 */
function getPrevRepeatValues(mainRow: RowItem, varName: string): VariableValueSingle[] {
  const values: VariableValueSingle[] = [];

  if (!mainRow.state.repeatedRows) {
    return [];
  }

  function collectVariableValue(row: RowItem) {
    const variable = sceneGraph.lookupVariable(varName, row);
    if (variable) {
      const value = variable.getValue();
      if (value != null && !Array.isArray(value)) {
        values.push(value);
      }
    }
  }

  collectVariableValue(mainRow);

  for (const row of mainRow.state.repeatedRows) {
    collectVariableValue(row);
  }

  return values;
}
