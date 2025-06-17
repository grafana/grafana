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

import { getCloneKey } from '../../utils/clone';
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
    performRowRepeats(variable, row);

    const sub = variable.subscribeToState((state) => performRowRepeats(variable, row));

    return () => sub.unsubscribe();
  }, [variable, row]);

  if (sceneGraph.hasVariableDependencyInLoadingState(variable) || variable.state.loading) {
    dashboardLog.logger('RowItemRepeater', false, 'Variable is loading, showing spinner');
    return <Spinner />;
  }

  return (
    <>
      <row.Component model={row} key={row.state.key!} />
      {repeatedRows?.map((rowClone) => <rowClone.Component model={rowClone} key={rowClone.state.key!} />)}
    </>
  );
}

export function performRowRepeats(variable: MultiValueVariable, row: RowItem) {
  if (sceneGraph.hasVariableDependencyInLoadingState(variable)) {
    dashboardLog.logger('RowItemRepeater', false, 'skipped dependency in loading state');
    return;
  }

  if (variable.state.loading) {
    dashboardLog.logger('RowItemRepeater', false, 'skipped, variable is loading');
    return;
  }

  const { values, texts } = getMultiVariableValues(variable);
  const prevValues = getPrevRepeatValues(row, variable.state.name);

  if (isEqual(prevValues, values)) {
    dashboardLog.logger('RowItemRepeater', false, 'skipped, values the same');
    return;
  }

  dashboardLog.logger('RowItemRepeater', false, 'performing repeats', values);

  const variableValues = values.length ? values : [''];
  const variableTexts = texts.length ? texts : variable.hasAllValue() ? ['All'] : ['None'];
  const clonedRows: RowItem[] = [];

  // Loop through variable values and create repeats
  for (let rowIndex = 0; rowIndex < variableValues.length; rowIndex++) {
    if (rowIndex === 0) {
      row.setState({
        $variables: new SceneVariableSet({
          variables: [
            new LocalValueVariable({
              name: variable.state.name,
              value: variableValues[rowIndex],
              text: String(variableTexts[rowIndex]),
              isMulti: variable.state.isMulti,
              includeAll: variable.state.includeAll,
            }),
          ],
        }),
      });
      continue;
    }

    const rowClone = row.clone({ repeatByVariable: undefined, repeatedRows: undefined });
    const rowCloneKey = getCloneKey(row.state.key!, rowIndex);
    const rowContentClone = row.state.layout.cloneLayout?.(rowCloneKey, false);

    rowClone.setState({
      key: rowCloneKey,
      $variables: new SceneVariableSet({
        variables: [
          new LocalValueVariable({
            name: variable.state.name,
            value: variableValues[rowIndex],
            text: String(variableTexts[rowIndex]),
            isMulti: variable.state.isMulti,
            includeAll: variable.state.includeAll,
          }),
        ],
      }),
      layout: rowContentClone,
    });

    clonedRows.push(rowClone);
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
