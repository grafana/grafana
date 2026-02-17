import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { SceneVariable } from '@grafana/scenes';
import { Button, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { getDefinition } from 'app/features/dashboard-scene/settings/variables/utils';

interface Props {
  variables: SceneVariable[];
  onEdit: (variable: SceneVariable) => void;
  onDelete: (variable: SceneVariable) => void;
  onAdd: () => void;
}

export function ExploreVariableListView({ variables, onEdit, onDelete, onAdd }: Props) {
  const styles = useStyles2(getStyles);

  if (variables.length === 0) {
    return (
      <Stack direction="column" gap={2} alignItems="center">
        <p className={styles.emptyText}>
          <Trans i18nKey="explore.variable-list.empty">No variables defined yet.</Trans>
        </p>
        <Button icon="plus" onClick={onAdd}>
          <Trans i18nKey="explore.variable-list.add-variable">Add variable</Trans>
        </Button>
      </Stack>
    );
  }

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>
              <Trans i18nKey="explore.variable-list.header-variable">Variable</Trans>
            </th>
            <th>
              <Trans i18nKey="explore.variable-list.header-definition">Definition</Trans>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {variables.map((variable) => (
            <tr key={variable.state.name}>
              <td className={styles.nameCell}>
                <span className={styles.variableName}>{variable.state.name}</span>
                <span className={styles.variableType}>{variable.state.type}</span>
              </td>
              <td className={styles.definitionCell}>{getDefinition(variable)}</td>
              <td className={styles.actionsCell}>
                <Stack direction="row" gap={1}>
                  <IconButton
                    name="pen"
                    tooltip={t('explore.variable-list.edit', 'Edit')}
                    onClick={() => onEdit(variable)}
                  />
                  <IconButton
                    name="trash-alt"
                    tooltip={t('explore.variable-list.delete', 'Delete')}
                    onClick={() => onDelete(variable)}
                  />
                </Stack>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.footer}>
        <Button icon="plus" variant="secondary" onClick={onAdd}>
          <Trans i18nKey="explore.variable-list.new-variable">New variable</Trans>
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  table: css({
    width: '100%',
    borderCollapse: 'collapse',
    'th, td': {
      padding: theme.spacing(1),
      textAlign: 'left',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },
    th: {
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
  nameCell: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  variableName: css({
    fontWeight: theme.typography.fontWeightMedium,
  }),
  variableType: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  definitionCell: css({
    color: theme.colors.text.secondary,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  actionsCell: css({
    textAlign: 'right',
  }),
  footer: css({
    marginTop: theme.spacing(1),
  }),
  emptyText: css({
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(4),
  }),
});
