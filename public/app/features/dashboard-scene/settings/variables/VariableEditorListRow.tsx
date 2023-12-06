import { css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { Draggable } from 'react-beautiful-dnd';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { SceneVariableState } from '@grafana/scenes';
import { Button, Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';
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
              aria-label={selectors.pages.Dashboard.Settings.Variables.List.tableRowNameFields(variable.name)}
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
            aria-label={selectors.pages.Dashboard.Settings.Variables.List.tableRowDefinitionFields(variable.name)}
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
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.tableRowDuplicateButtons(variable.name)}
              />
              <IconButton
                onClick={(event) => {
                  event.preventDefault();
                  reportInteraction('Delete variable');
                  propsOnDelete(identifier);
                }}
                name="trash-alt"
                tooltip="Remove variable"
                aria-label={selectors.pages.Dashboard.Settings.Variables.List.tableRowRemoveButtons(variable.name)}
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

function getStyles(theme: GrafanaTheme2) {
  return {
    dragHandle: css`
      cursor: grab;
      margin-left: ${theme.spacing(1)};
    `,
    column: css`
      width: 1%;
    `,
    nameLink: css`
      cursor: pointer;
      color: ${theme.colors.primary.text};
    `,
    definitionColumn: css`
      width: 100%;
      max-width: 200px;
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      -o-text-overflow: ellipsis;
      white-space: nowrap;
    `,
    iconPassed: css`
      color: ${theme.v1.palette.greenBase};
      margin-right: ${theme.spacing(2)};
    `,
    iconFailed: css`
      color: ${theme.v1.palette.orange};
      margin-right: ${theme.spacing(2)};
    `,
    icons: css`
      display: flex;
      gap: ${theme.spacing(2)};
      align-items: center;
    `,
  };
}
