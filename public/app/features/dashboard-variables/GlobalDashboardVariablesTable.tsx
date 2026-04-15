import { t } from '@grafana/i18n';
import { type VariableKind } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { IconButton, Stack, Text } from '@grafana/ui';
import { type Resource } from 'app/features/apiserver/types';
import { VARIABLE_FOLDER_LABEL_KEY } from 'app/features/dashboard-scene/utils/globalDashboardVariables';

type Props = {
  items: Array<Resource<VariableKind>>;
  onEdit: (row: Resource<VariableKind>) => void;
  onDelete: (row: Resource<VariableKind>) => void;
};

export function GlobalDashboardVariablesTable({ items, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <Text color="secondary">
        {t('global-variables.table.empty', 'No global variables yet. Create one to use it on dashboards.')}
      </Text>
    );
  }

  return (
    <table className="filter-table filter-table--hover" role="grid">
      <thead>
        <tr>
          <th>{t('global-variables.table.name', 'Name')}</th>
          <th>{t('global-variables.table.kind', 'Kind')}</th>
          <th>{t('global-variables.table.scope', 'Scope')}</th>
          <th style={{ width: '1%' }} />
        </tr>
      </thead>
      <tbody>
        {items.map((row) => {
          const spec = row.spec;
          const folder = row.metadata.labels?.[VARIABLE_FOLDER_LABEL_KEY];
          const scope = folder
            ? t('global-variables.table.scope-folder', 'Folder: {{uid}}', { uid: folder })
            : t('global-variables.table.scope-org', 'Organization');
          return (
            <tr key={row.metadata.name}>
              <td>{spec.spec.name ?? row.metadata.name}</td>
              <td>{spec.kind ?? '—'}</td>
              <td>{scope}</td>
              <td>
                <Stack direction="row" gap={0}>
                  <IconButton name="pen" tooltip={t('global-variables.table.edit', 'Edit')} onClick={() => onEdit(row)} />
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
      </tbody>
    </table>
  );
}
