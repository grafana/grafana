import { css } from '@emotion/css';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  LocalValueVariable,
  MultiValueVariable,
  SceneComponentProps,
  sceneGraph,
  SceneVariableSet,
} from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { getCloneKey } from '../../utils/clone';
import { getMultiVariableValues, useDashboardState } from '../../utils/utils';
import { useClipboardState } from '../layouts-shared/useClipboardState';

import { RowItem } from './RowItem';
import { RowsLayoutManager } from './RowsLayoutManager';

export function RowLayoutManagerRenderer({ model }: SceneComponentProps<RowsLayoutManager>) {
  const { rows, key } = model.useState();
  const { isEditing } = useDashboardState(model);
  const styles = useStyles2(getStyles);
  const { hasCopiedRow } = useClipboardState();

  return (
    <DragDropContext
      onBeforeDragStart={(start) => model.forceSelectRow(start.draggableId)}
      onDragEnd={(result) => {
        if (!result.destination) {
          return;
        }

        if (result.destination.index === result.source.index) {
          return;
        }

        model.moveRow(result.draggableId, result.source.index, result.destination.index);
      }}
    >
      <Droppable droppableId={key!} direction="vertical">
        {(dropProvided) => (
          <div className={styles.wrapper} ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
            {rows.map((row) => (
              <RowWrapper row={row} manager={model} key={row.state.key!} />
            ))}
            {dropProvided.placeholder}
            {isEditing && (
              <div className="dashboard-canvas-add-button">
                <Button icon="plus" variant="primary" fill="text" onClick={() => model.addNewRow()}>
                  <Trans i18nKey="dashboard.canvas-actions.new-row">New row</Trans>
                </Button>
                {hasCopiedRow && (
                  <Button icon="clipboard-alt" variant="primary" fill="text" onClick={() => model.pasteRow()}>
                    <Trans i18nKey="dashboard.canvas-actions.paste-row">Paste row</Trans>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

function RowWrapper({ row, manager }: { row: RowItem; manager: RowsLayoutManager }) {
  const { repeatByVariable } = row.useState();

  if (repeatByVariable) {
    const variable = sceneGraph.lookupVariable(repeatByVariable, manager);

    if (variable && variable instanceof MultiValueVariable) {
      return <RepeatingRow row={row} key={row.state.key!} manager={manager} variable={variable} />;
    }
  }

  return <row.Component model={row} key={row.state.key!} />;
}

function RepeatingRow({
  row,
  manager,
  variable,
}: {
  row: RowItem;
  manager: RowsLayoutManager;
  variable: MultiValueVariable;
}) {
  const { repeatedRows } = row.useState();

  const { value } = variable.useState();

  useEffect(() => {
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
  }, [value, variable, row]);

  return (
    <>
      <row.Component model={row} key={row.state.key!} />
      {repeatedRows?.map((rowClone) => <rowClone.Component model={rowClone} key={row.state.key!} />)}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      flexGrow: 1,
      width: '100%',
    }),
  };
}
