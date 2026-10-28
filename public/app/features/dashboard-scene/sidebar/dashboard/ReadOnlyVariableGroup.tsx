import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SceneVariable } from '@grafana/scenes';
import { IconButton, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { getPredefinedOrigin } from '../../utils/predefinedVariables';

import { selectSidebarObject } from './helpers';
import { predefinedScopeTooltip } from './partitionSidebarVariables';
import { confirmRemovePredefinedVariable } from './variableListActions';

export function ReadOnlyVariableRows({ variables, itemTestId }: { variables: SceneVariable[]; itemTestId: string }) {
  const styles = useStyles2(getStyles);

  if (variables.length === 0) {
    return null;
  }

  return (
    <>
      {variables.map((variable) => {
        const origin = getPredefinedOrigin(variable.state.origin);
        if (!origin) {
          return null;
        }
        const tooltip = predefinedScopeTooltip(origin);
        const itemKey = variable.state.key ?? variable.state.name;
        return (
          <li key={itemKey} className={styles.row}>
            <Tooltip content={tooltip}>
              <button type="button" className={styles.button} onClick={() => selectSidebarObject(variable)}>
                <Text variant="body" truncate>
                  <span data-testid={itemTestId}>{variable.state.name}</span>
                </Text>
              </button>
            </Tooltip>
            <IconButton
              name="trash-alt"
              variant="secondary"
              tooltip={t('dashboard.sidebar.variable.remove', 'Remove')}
              className={styles.removeButton}
              data-testid={selectors.components.PanelEditor.ElementEditPane.List.ListItem.deleteButton(itemKey)}
              onClick={() => confirmRemovePredefinedVariable(variable)}
            />
          </li>
        );
      })}
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      minHeight: theme.spacing(4),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      '&:hover, &:focus-within': {
        color: theme.colors.text.maxContrast,
        backgroundColor: theme.colors.action.hover,
        boxShadow: `-${theme.spacing(1)} 0 0 0 ${theme.colors.action.hover}`,
      },
      '&:hover button, &:focus-within button': {
        visibility: 'visible',
      },
    }),
    removeButton: css({
      visibility: 'hidden',
      flexShrink: 0,
      '&:hover, &:focus-within': {
        color: theme.colors.error.text,
      },
    }),
    button: css({
      display: 'flex',
      alignItems: 'center',
      flexGrow: 1,
      minWidth: 0,
      minHeight: theme.spacing(4),
      padding: 0,
      paddingLeft: theme.spacing(1),
      border: 'none',
      background: 'none',
      color: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
    }),
  };
}
