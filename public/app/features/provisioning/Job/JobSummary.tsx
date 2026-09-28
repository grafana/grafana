import { t } from '@grafana/i18n';
import { Icon, InteractiveTable, Stack } from '@grafana/ui';
import { type JobResourceSummary } from 'app/api/clients/provisioning/v0alpha1';

import { getKindInfoByGroupKind } from '../utils/resourceKinds';

type SummaryCell = {
  row: {
    original: JobResourceSummary;
  };
};

const getSummaryColumns = () => [
  {
    id: 'resource',
    header: t('provisioning.job-summary.column-resource', 'Resource'),
    cell: ({ row: { original: item } }: SummaryCell) => {
      const info = getKindInfoByGroupKind(item.group, item.kind);
      const kind = item.kind || t('provisioning.job-summary.unknown-kind', 'Unknown');
      return (
        <Stack direction="row" alignItems="center" gap={1}>
          <Icon name={info?.icon ?? 'question-circle'} />
          <span>{kind}</span>
        </Stack>
      );
    },
  },
  {
    id: 'created',
    header: t('provisioning.job-summary.column-created', 'Created'),
    cell: ({ row: { original: item } }: SummaryCell) => item.create?.toString() || '-',
  },
  {
    id: 'deleted',
    header: t('provisioning.job-summary.column-deleted', 'Deleted'),
    cell: ({ row: { original: item } }: SummaryCell) => item.delete?.toString() || '-',
  },
  {
    id: 'updated',
    header: t('provisioning.job-summary.column-updated', 'Updated'),
    cell: ({ row: { original: item } }: SummaryCell) => item.update?.toString() || '-',
  },
  {
    id: 'unchanged',
    header: t('provisioning.job-summary.column-unchanged', 'Unchanged'),
    cell: ({ row: { original: item } }: SummaryCell) => item.noop?.toString() || '-',
  },
  {
    id: 'warnings',
    header: t('provisioning.job-summary.column-warnings', 'Warnings'),
    cell: ({ row: { original: item } }: SummaryCell) => item.warning?.toString() || '-',
  },
  {
    id: 'errors',
    header: t('provisioning.job-summary.column-errors', 'Errors'),
    cell: ({ row: { original: item } }: SummaryCell) => item.error?.toString() || '-',
  },
  {
    id: 'total',
    header: t('provisioning.job-summary.column-total', 'Total'),
    cell: ({ row: { original: item } }: SummaryCell) => {
      const total = (item.create || 0) + (item.delete || 0) + (item.update || 0) + (item.noop || 0) + (item.error || 0);
      return total.toString();
    },
  },
];

interface Props {
  summary: JobResourceSummary[];
}

export function JobSummary({ summary }: Props) {
  return (
    <Stack direction="column" gap={2}>
      <InteractiveTable
        data={summary}
        columns={getSummaryColumns()}
        getRowId={(item) => `${item.group ?? ''}/${item.kind ?? ''}`}
        pageSize={10}
      />
    </Stack>
  );
}
