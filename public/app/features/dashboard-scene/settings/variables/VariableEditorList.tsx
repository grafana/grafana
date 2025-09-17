import { css } from '@emotion/css';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import classNames from 'classnames';
import { ReactElement } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariable, SceneVariableState } from '@grafana/scenes';
import { useStyles2, Stack, Button, EmptyState, TextLink } from '@grafana/ui';

import { isVariableEditable } from '../../serialization/sceneVariablesSetToVariables';
import { DashboardInteractions } from '../../utils/interactions';
import { VariablesDependenciesButton } from '../../variables/VariablesDependenciesButton';
import { UsagesToNetwork, VariableUsageTree } from '../../variables/utils';

import { VariableEditorListRow } from './VariableEditorListRow';

export interface Props {
  variables: Array<SceneVariable<SceneVariableState>>;
  usages: VariableUsageTree[];
  usagesNetwork: UsagesToNetwork[];
  onAdd: () => void;
  onChangeOrder: (fromIndex: number, toIndex: number) => void;
  onDuplicate: (identifier: string) => void;
  onDelete: (identifier: string) => void;
  onEdit: (identifier: string) => void;
}

export function VariableEditorList({
  variables,
  usages,
  usagesNetwork,
  onChangeOrder,
  onDelete,
  onDuplicate,
  onAdd,
  onEdit,
}: Props): ReactElement {
  const styles = useStyles2(getStyles);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !result.source) {
      return;
    }

    reportInteraction('Variable drag and drop');
    onChangeOrder(result.source.index, result.destination.index);
  };

  const onVariableAdd = () => {
    onAdd();
    DashboardInteractions.addVariableButtonClicked({ source: 'settings_pane' });
  };

  const editableVariables = variables.filter(isVariableEditable);

  return editableVariables.length <= 0 ? (
    <EmptyVariablesList onAdd={onVariableAdd} />
  ) : (
    <Stack direction="column" gap={3}>
      <table
        className={classNames('filter-table', 'filter-table--hover', styles.tableContainer)}
        data-testid={selectors.pages.Dashboard.Settings.Variables.List.table}
        role="grid"
      >
        <thead>
          <tr>
            <th>
              <Trans i18nKey="dashboard-scene.variable-editor-list.variable">Variable</Trans>
            </th>
            <th>
              <Trans i18nKey="dashboard-scene.variable-editor-list.definition">Definition</Trans>
            </th>
            <th colSpan={5} />
          </tr>
        </thead>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="variables-list" direction="vertical">
            {(provided) => (
              <tbody ref={provided.innerRef} {...provided.droppableProps}>
                {variables.map((variableScene, index) => {
                  if (!isVariableEditable(variableScene)) {
                    return null;
                  }

                  const variableState = variableScene.state;
                  return (
                    <VariableEditorListRow
                      index={index}
                      key={`${variableState.name}-${index}`}
                      variable={variableScene}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      onEdit={onEdit}
                      usageTree={usages}
                      usagesNetwork={usagesNetwork}
                    />
                  );
                })}
                {provided.placeholder}
              </tbody>
            )}
          </Droppable>
        </DragDropContext>
      </table>
      <Stack>
        <VariablesDependenciesButton variables={variables} />
        <Button
          data-testid={selectors.pages.Dashboard.Settings.Variables.List.newButton}
          onClick={onVariableAdd}
          icon="plus"
        >
          <Trans i18nKey="dashboard-scene.variable-editor-list.new-variable">New variable</Trans>
        </Button>
      </Stack>
    </Stack>
  );
}

function EmptyVariablesList({ onAdd }: { onAdd: () => void }) {
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
    overflow: 'auto',
  }),
});
