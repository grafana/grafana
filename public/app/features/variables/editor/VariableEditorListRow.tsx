import { css } from '@emotion/css';
import { Draggable } from '@hello-pangea/dnd';
import { ReactElement } from 'react';

import { GrafanaTheme2, TypedVariableModel } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Button, Icon, IconButton, useStyles2, useTheme2 } from '@grafana/ui';

import { hasOptions } from '../guard';
import { VariableUsagesButton } from '../inspect/VariableUsagesButton';
import { getVariableUsages, UsagesToNetwork, VariableUsageTree } from '../inspect/utils';
import { KeyedVariableIdentifier } from '../state/types';
import { toKeyedVariableIdentifier } from '../utils';

export interface VariableEditorListRowProps {
  index: number;
  variable: TypedVariableModel;
  usageTree: VariableUsageTree[];
  usagesNetwork: UsagesToNetwork[];
  onEdit: (identifier: KeyedVariableIdentifier) => void;
  onDuplicate: (identifier: KeyedVariableIdentifier) => void;
  onDelete: (identifier: KeyedVariableIdentifier) => void;
}

export function VariableEditorListRow({
  index,
  variable,
  usageTree,
  usagesNetwork,
  onEdit: propsOnEdit,
  onDuplicate: propsOnDuplicate,
  onDelete: propsOnDelete,
}: VariableEditorListRowProps): ReactElement {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const definition = getDefinition(variable);
  const usages = getVariableUsages(variable.id, usageTree);
  const passed = usages > 0 || variable.type === 'adhoc';
  const identifier = toKeyedVariableIdentifier(variable);

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
              <VariableCheckIndicator passed={passed} />
              <VariableUsagesButton id={variable.id} isAdhoc={variable.type === 'adhoc'} usages={usagesNetwork} />
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

function getDefinition(model: TypedVariableModel): string {
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

interface VariableCheckIndicatorProps {
  passed: boolean;
}

function VariableCheckIndicator({ passed }: VariableCheckIndicatorProps): ReactElement {
  const styles = useStyles2(getStyles);
  if (passed) {
    return (
      <Icon
        name="check"
        className={styles.iconPassed}
        title="This variable is referenced by other variables or dashboard."
      />
    );
  }

  return (
    <Icon
      name="exclamation-triangle"
      className={styles.iconFailed}
      title="This variable is not referenced by any variable or dashboard."
    />
  );
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
      OTextOverflow: 'ellipsis',
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
