import { t } from '@grafana/i18n';
import { Icon, InteractiveTable, Stack } from '@grafana/ui';
import { type JobResourceSummary } from 'app/api/clients/provisioning/v0alpha1';

import { getKindInfoByGroupKind, getReportedGroup } from '../utils/resourceKinds';

type SummaryCell = {
  row: {
    original: JobResourceSummary;
  };
};

/** Counters summed when two rows of a kind are merged; the rest identify the row. */
const COUNTERS = ['create', 'update', 'delete', 'write', 'noop', 'error', 'warning', 'total', 'totalChanges'] as const;

/**
 * Merges the rows of a kind that several API groups serve into one per kind. Every data source
 * plugin serves its own group, so the job reports one row per plugin for what the user asked for
 * as a single kind.
 */
function aggregateByKind(summary: JobResourceSummary[]): JobResourceSummary[] {
  const merged = new Map<string, JobResourceSummary>();
  for (const item of summary) {
    const group = getReportedGroup(item.group, item.kind);
    const key = `${group ?? ''}/${item.kind ?? ''}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, group });
      continue;
    }
    for (const counter of COUNTERS) {
      // A counter neither row reported stays unset, so its column still renders a dash.
      if (existing[counter] !== undefined || item[counter] !== undefined) {
        existing[counter] = (existing[counter] ?? 0) + (item[counter] ?? 0);
      }
    }
    existing.errors = [...(existing.errors ?? []), ...(item.errors ?? [])];
    existing.warnings = [...(existing.warnings ?? []), ...(item.warnings ?? [])];
  }
  return Array.from(merged.values());
}

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
        data={aggregateByKind(summary)}
        columns={getSummaryColumns()}
        getRowId={(item) => `${item.group ?? ''}/${item.kind ?? ''}`}
        pageSize={10}
      />
    </Stack>
  );
}
