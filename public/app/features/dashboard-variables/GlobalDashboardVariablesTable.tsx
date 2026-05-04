import { css, cx } from '@emotion/css';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Icon, IconButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { type Resource } from 'app/features/apiserver/types';

export type GlobalVariablesGroup = {
  id: string;
  title: string;
  variables: Array<Resource<VariableKind>>;
};

type Props = {
  groups: GlobalVariablesGroup[];
  onEdit: (row: Resource<VariableKind>) => void;
  onDelete: (row: Resource<VariableKind>) => void;
};

export function GlobalDashboardVariablesTable({ groups, onEdit, onDelete }: Props) {
  const styles = useStyles2(getStyles);
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set(['org']));
  const visibleVariablesCount = useMemo(
    () => groups.reduce((total, group) => total + group.variables.length, 0),
    [groups]
  );

  useEffect(() => {
    setOpenGroupIds((prev) => {
      const next = new Set<string>();
      for (const group of groups) {
        if (prev.has(group.id) || group.id === 'org') {
          next.add(group.id);
        }
      }
      return next;
    });
  }, [groups]);

  if (visibleVariablesCount === 0) {
    return (
      <Text color="secondary">
        {t('global-variables.table.empty', 'No global variables yet. Create one to use it on dashboards.')}
      </Text>
    );
  }

  return (
    <table className={cx('filter-table filter-table--hover', styles.table)} role="grid">
      <colgroup>
        <col />
        <col className={styles.kindCol} />
        <col className={styles.actionsCol} />
      </colgroup>
      <thead>
        <tr>
          <th>{t('global-variables.table.name', 'Name')}</th>
          <th className={styles.kindColumn}>{t('global-variables.table.kind', 'Kind')}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const isOpen = openGroupIds.has(group.id);
          return (
            <Fragment key={group.id}>
              <tr className={styles.row}>
                <td>
                  <button
                    type="button"
                    className={styles.groupButton}
                    style={{
                      alignItems: 'center',
                      display: 'inline-flex',
                      gap: '6px',
                    }}
                    onClick={() =>
                      setOpenGroupIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(group.id)) {
                          next.delete(group.id);
                        } else {
                          next.add(group.id);
                        }
                        return next;
                      })
                    }
                  >
                    <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
                    <strong>{group.title}</strong>
                    <Text color="secondary">
                      {t('global-variables.table.group-count', '({{count}})', { count: group.variables.length })}
                    </Text>
                  </button>
                </td>
                <td className={styles.kindColumn} />
                <td />
              </tr>
              {isOpen &&
                group.variables.map((row) => {
                  const spec = row.spec;
                  return (
                    <tr key={row.metadata.name} className={styles.childRow}>
                      <td className={styles.clickableCell} onClick={() => onEdit(row)}>
                        <div className={styles.childNameLabel}>{spec.spec.name ?? row.metadata.name}</div>
                      </td>
                      <td className={cx(styles.clickableCell, styles.kindColumn)} onClick={() => onEdit(row)}>
                        {spec.kind ?? '—'}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <Stack direction="row" gap={0}>
                          <IconButton
                            name="trash-alt"
                            tooltip={t('global-variables.table.delete', 'Delete')}
                            onClick={() => onDelete(row)}
                          />
                        </Stack>
                      </td>
                    </tr>
                  );
                })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css({
    tableLayout: 'fixed',
  }),
  singleBackgroundRows: css({
    backgroundColor: theme.colors.background.primary,
    'tbody tr, tbody tr:nth-of-type(odd), tbody tr:nth-of-type(even)': {
      backgroundColor: theme.colors.background.primary,
    },
    'tbody tr:hover': {
      backgroundColor: theme.colors.action.hover,
    },
  }),
  row: css({
    backgroundColor: theme.colors.background.primary,
  }),
  groupButton: css({
    border: 0,
    padding: 0,
    margin: 0,
    background: 'transparent',
    color: theme.colors.text.primary,
    cursor: 'pointer',
    font: 'inherit',
    textDecoration: 'none',
  }),
  childNameLabel: css({
    display: 'inline-flex',
    alignItems: 'center',
    paddingLeft: theme.spacing(4),
  }),
  childRow: css({
    backgroundColor: theme.colors.background.primary,
  }),
  clickableCell: css({
    cursor: 'pointer',
  }),
  kindColumn: css({
    textAlign: 'left',
  }),
  kindCol: css({
    width: '30%',
  }),
  actionsCol: css({
    width: '1%',
  }),
});
