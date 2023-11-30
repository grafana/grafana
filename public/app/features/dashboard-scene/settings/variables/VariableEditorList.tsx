import { css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { TypedVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariables, SceneVariableState } from '@grafana/scenes';
import { useStyles2, Stack } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { hasOptions } from 'app/features/variables/guard';
import { KeyedVariableIdentifier } from 'app/features/variables/state/types';

export interface Props {
  variablesSet: SceneVariables;
  variables: TypedVariableModel[];
  onAdd: () => void;
  onChangeOrder: (identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) => void;
  onDuplicate: (identifier: KeyedVariableIdentifier) => void;
  onDelete: (identifier: KeyedVariableIdentifier) => void;
}

export function VariableEditorList({
  variables,
  variablesSet,
  onChangeOrder,
  onDelete,
  onDuplicate,
  onAdd,
}: Props): ReactElement {
  const styles = useStyles2(getStyles);
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !result.source) {
      return;
    }
    reportInteraction('Variable drag and drop');
    const identifier = JSON.parse(result.draggableId);
    onChangeOrder(identifier, variables[result.source.index].index, variables[result.destination.index].index);
  };

  const variablesSetState = variablesSet.state.variables;

  return (
    <div>
      <div>
        {variables.length === 0 && <EmptyVariablesList onAdd={onAdd} />}

        {variablesSet && (
          <Stack direction="column" gap={4}>
            <div className={styles.tableContainer}>
              <table
                className="filter-table filter-table--hover"
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.table}
                role="grid"
              >
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Definition</th>
                    <th colSpan={5} />
                  </tr>
                </thead>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="variables-list" direction="vertical">
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps}>
                        {variablesSetState.map((variable, index) => {
                          const definition = getDefinition(variable.state);
                          return (
                            <tr key={`${variable.state.name}-${index}`}>
                              <td>{variable.state.name}</td>
                              <td>{definition}</td>
                            </tr>
                          );
                        })}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </div>
          </Stack>
        )}
        {/** Test Using old variable format witouth VariableEditorListRow -- triggered some error regarding identifier */}
        {variables.length > 0 && (
          <Stack direction="column" gap={4}>
            <div className={styles.tableContainer}>
              <table
                className="filter-table filter-table--hover"
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.table}
                role="grid"
              >
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Definition</th>
                    <th colSpan={5} />
                  </tr>
                </thead>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="variables-list" direction="vertical">
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps}>
                        {variables.map((variable, index) => {
                          const definition = getDefinition(variable);
                          return (
                            <tr key={`${variable.name}-${index}`}>
                              <td>{variable.name}</td>
                              <td>{definition}</td>
                            </tr>
                          );
                        })}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </DragDropContext>
              </table>
            </div>
          </Stack>
        )}
      </div>
    </div>
  );
}

function EmptyVariablesList({ onAdd }: { onAdd: () => void }): ReactElement {
  return (
    <div>
      <EmptyListCTA
        title="There are no variables yet"
        buttonIcon="calculator-alt"
        buttonTitle="Add variable"
        infoBox={{
          __html: ` <p>
                    Variables enable more interactive and dynamic dashboards. Instead of hard-coding things like server
                    or sensor names in your metric queries you can use variables in their place. Variables are shown as
                    list boxes at the top of the dashboard. These drop-down lists make it easy to change the data
                    being displayed in your dashboard. Check out the
                    <a class="external-link" href="https://grafana.com/docs/grafana/latest/variables/" target="_blank">
                      Templates and variables documentation
                    </a>
                    for more information.
                  </p>`,
        }}
        infoBoxTitle="What do variables do?"
        onClick={(event) => {
          event.preventDefault();
          onAdd();
        }}
      />
    </div>
  );
}

function getDefinition(model: SceneVariableState): string {
  let definition = '';
  if (model.type === 'query') {
    if (model.definition) {
      definition = model.definition;
    } else if (typeof model.query === 'string') {
      definition = model.query;
    }
  } else if (hasOptions(model)) {
    definition = model.query;
  }

  return definition;
}

const getStyles = () => ({
  tableContainer: css`
    overflow: scroll;
    width: 100%;
  `,
});
