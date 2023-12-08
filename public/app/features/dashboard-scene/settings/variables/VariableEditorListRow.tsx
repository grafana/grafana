import { css } from '@emotion/css';
import React, { ReactElement, useState } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { QueryVariable, SceneVariableState } from '@grafana/scenes';
import { Button, ConfirmModal, Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
import { hasOptions } from 'app/features/variables/guard';

export interface VariableEditorListRowProps {
  index: number;
  variable: SceneVariableState;
  onEdit: (identifier: string) => void;
  onDuplicate: (identifier: string) => void;
  onDelete: (identifier: string) => void;
}

export function VariableEditorListRow({
  index,
  variable,
  onEdit: propsOnEdit,
  onDuplicate: propsOnDuplicate,
  onDelete: propsOnDelete,
}: VariableEditorListRowProps): ReactElement {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const definition = getDefinition(variable);
  const identifier = variable.name;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const handleDeleteVariableModal = (show: boolean) => () => {
    setShowDeleteModal(show);
  };
  const onDeleteVariable = () => {
    reportInteraction('Delete variable');
    propsOnDelete(identifier);
  };

  return (
    <Draggable draggableId={JSON.stringify(identifier)} index={index}>
      {(provided, snapshot) => (
        <tr
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            userSelect: snapshot.isDragging ? 'none' : 'auto',
            background: snapshot.isDragging ? theme.colors.background.secondary : undefined,
            ...provided.draggableProps.style,
          }}
        >
          <td role="gridcell" className={styles.column}>
            <Button
              size="xs"
              fill="text"
              onClick={(event) => {
                event.preventDefault();
                propsOnEdit(identifier);
              }}
              className={styles.nameLink}
              data-testid={selectors.pages.Dashboard.Settings.Variables.List.tableRowNameFields(variable.name)}
            >
              {variable.name}
            </Button>
          </td>
          <td
            role="gridcell"
            className={styles.definitionColumn}
            onClick={(event) => {
              event.preventDefault();
              propsOnEdit(identifier);
            }}
            data-testid={selectors.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(variable.name)}
          >
            {definition}
          </td>

          <td role="gridcell" className={styles.column}>
            <div className={styles.icons}>
              <IconButton
                onClick={(event) => {
                  event.preventDefault();
                  reportInteraction('Duplicate variable');
                  propsOnDuplicate(identifier);
                }}
                name="copy"
                tooltip="Duplicate variable"
                data-testid={selectors.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(variable.name)}
              />
              <IconButton
                onClick={(event) => {
                  event.preventDefault();
                  handleDeleteVariableModal(true);
                }}
                name="trash-alt"
                tooltip="Remove variable"
                data-testid={selectors.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(variable.name)}
              />
              <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete variable"
                body={`Are you sure you want to delete: ${variable.name}?`}
                confirmText="Delete variable"
                onConfirm={onDeleteVariable}
                onDismiss={handleDeleteVariableModal(false)}
              />

              <div {...provided.dragHandleProps} className={styles.dragHandle}>
                <Icon name="draggabledots" size="lg" />
              </div>
            </div>
          </td>
        </tr>
      )}
    </Draggable>
  );
}

function getDefinition(model: SceneVariableState): string {
  let definition = '';
  if (model instanceof QueryVariable) {
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

function getStyles(theme: GrafanaTheme2) {
  return {
    dragHandle: css({
      cursor: 'grab',
      marginLeft: theme.spacing(1),
    }),
    column: css({
      width: '1%',
    }),
    nameLink: css({
      cursor: 'pointer',
      color: theme.colors.primary.text,
    }),
    definitionColumn: css({
      width: '100%',
      maxWidth: '200px',
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    iconPassed: css({
      color: theme.v1.palette.greenBase,
      marginRight: theme.spacing(2),
    }),
    iconFailed: css({
      color: theme.v1.palette.orange,
      marginRight: theme.spacing(2),
    }),
    icons: css({
      display: 'flex',
      gap: theme.spacing(2),
      alignItems: 'center',
    }),
  };
}
