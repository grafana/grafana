import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { ReactElement } from 'react';

import { TypedVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { Button, useStyles2, Stack, EmptyState, TextLink } from '@grafana/ui';

import { VariablesDependenciesButton } from '../inspect/VariablesDependenciesButton';
import { UsagesToNetwork, VariableUsageTree } from '../inspect/utils';
import { KeyedVariableIdentifier } from '../state/types';

import { VariableEditorListRow } from './VariableEditorListRow';

export interface Props {
  variables: TypedVariableModel[];
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
  const styles = useStyles2(getStyles);
  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !result.source) {
      return;
    }
    reportInteraction('Variable drag and drop');
    const identifier = JSON.parse(result.draggableId);
    onChangeOrder(identifier, variables[result.source.index].index, variables[result.destination.index].index);
  };

  return (
    <div>
      <div>
        {variables.length === 0 && <EmptyVariablesList onAdd={onAdd} />}

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
                    <th>
                      <Trans i18nKey="variables.variable-editor-list.variable">Variable</Trans>
                    </th>
                    <th>
                      <Trans i18nKey="variables.variable-editor-list.definition">Definition</Trans>
                    </th>
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
            </div>
            <Stack>
              <VariablesDependenciesButton variables={variables} />
              <Button
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.newButton}
                onClick={onAdd}
                icon="plus"
              >
                <Trans i18nKey="variables.variable-editor-list.new-variable">New variable</Trans>
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
    <Stack direction="column">
      <EmptyState
        variant="call-to-action"
        button={
          <Button
            data-testid={selectors.components.CallToActionCard.buttonV2('Add variable')}
            icon="calculator-alt"
            onClick={onAdd}
            size="lg"
          >
            <Trans i18nKey="variables.empty-state.button-title">Add variable</Trans>
          </Button>
        }
        message={t('variables.empty-state.title', 'There are no variables added yet')}
      >
        <p>
          <Trans i18nKey="variables.empty-state.info-box-content">
            Variables enable more interactive and dynamic dashboards. Instead of hard-coding things like server or
            sensor names in your metric queries you can use variables in their place. Variables are shown as list boxes
            at the top of the dashboard. These drop-down lists make it easy to change the data being displayed in your
            dashboard.
          </Trans>
        </p>
        <Trans i18nKey="variables.empty-state.info-box-content-2">
          Check out the{' '}
          <TextLink external href="https://grafana.com/docs/grafana/latest/variables/">
            Templates and variables documentation
          </TextLink>{' '}
          for more information.
        </Trans>
      </EmptyState>
    </Stack>
  );
}

const getStyles = () => ({
  tableContainer: css({
    overflow: 'scroll',
    width: '100%',
  }),
});
