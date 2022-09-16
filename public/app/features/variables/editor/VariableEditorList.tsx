import React, { ReactElement } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Stack } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { UsagesToNetwork, VariableUsageTree } from '../inspect/utils';
import { KeyedVariableIdentifier } from '../state/types';
import { VariableModel } from '../types';

import { VariableEditorListRow } from './VariableEditorListRow';

export interface Props {
  variables: VariableModel[];
  usages: VariableUsageTree[];
  usagesNetwork: UsagesToNetwork[];
  onAdd: () => void;
  onEdit: (identifier: KeyedVariableIdentifier) => void;
  onChangeOrder: (identifier: KeyedVariableIdentifier, fromIndex: number, toIndex: number) => void;
  onDuplicate: (identifier: KeyedVariableIdentifier) => void;
  onDelete: (identifier: KeyedVariableIdentifier) => void;
}

export function VariableEditorList({
  variables,
  usages,
  usagesNetwork,
  onChangeOrder,
  onAdd,
  onEdit,
  onDelete,
  onDuplicate,
}: Props): ReactElement {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !result.source) {
      return;
    }
    reportInteraction('Variable drag and drop');
    const identifier = JSON.parse(result.draggableId);
    onChangeOrder(identifier, result.source.index, result.destination.index);
  };

  return (
    <div>
      <div>
        {variables.length === 0 && <EmptyVariablesList onAdd={onAdd} />}

        {variables.length > 0 && (
          <Stack direction="column" gap={4}>
            <table
              className="filter-table filter-table--hover"
              aria-label={selectors.pages.Dashboard.Settings.Variables.List.table}
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
                      {variables.map((variable, index) => (
                        <VariableEditorListRow
                          index={index}
                          key={`${variable.name}-${index}`}
                          variable={variable}
                          usageTree={usages}
                          usagesNetwork={usagesNetwork}
                          onDelete={onDelete}
                          onDuplicate={onDuplicate}
                          onEdit={onEdit}
                        />
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            </table>
            <Stack>
              <VariablesDependenciesButton variables={variables} />
              <Button
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
                onClick={onAdd}
                icon="plus"
              >
                New variable
              </Button>
            </Stack>
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
