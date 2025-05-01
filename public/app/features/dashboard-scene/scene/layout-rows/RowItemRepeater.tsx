import { useEffect } from 'react';

import { MultiValueVariable, SceneVariableSet, LocalValueVariable, sceneGraph } from '@grafana/scenes';

import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues } from '../../utils/utils';
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
  manager,
  variable,
}: {
  row: RowItem;
  manager: RowsLayoutManager;
  variable: MultiValueVariable;
}) {
  const { repeatedRows } = row.useState();

  useEffect(() => {
    if (!sceneGraph.hasVariableDependencyInLoadingState(row)) {
      performRowRepeats(variable, row);
    }

    const unsub = manager.registerVariableChangeHandler({
      variable,
      handler: () => performRowRepeats(variable, row),
    });

    return unsub;
  }, [variable, row, manager]);

  return (
    <>
      <row.Component model={row} key={row.state.key!} />
      {repeatedRows?.map((rowClone) => <rowClone.Component model={rowClone} key={rowClone.state.key!} />)}
    </>
  );
}

export function performRowRepeats(variable: MultiValueVariable, row: RowItem) {
  const { values, texts } = getMultiVariableValues(variable);

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
