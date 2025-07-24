import { InteractiveTable, Stack } from '@grafana/ui';
import { JobResourceSummary } from 'app/api/clients/provisioning/v0alpha1';

type SummaryCell<T extends keyof JobResourceSummary = keyof JobResourceSummary> = {
  row: {
    original: JobResourceSummary;
  };
};

const getSummaryColumns = () => [
  {
    id: 'resource',
    header: 'Resource',
    cell: ({ row: { original: item } }: SummaryCell) => item.resource,
  },
  {
    id: 'created',
    header: 'Created',
    cell: ({ row: { original: item } }: SummaryCell) => item.create?.toString() || '-',
  },
  {
    id: 'deleted',
    header: 'Deleted',
    cell: ({ row: { original: item } }: SummaryCell) => item.delete?.toString() || '-',
  },
  {
    id: 'updated',
    header: 'Updated',
    cell: ({ row: { original: item } }: SummaryCell) => item.update?.toString() || '-',
  },
  {
    id: 'unchanged',
    header: 'Unchanged',
    cell: ({ row: { original: item } }: SummaryCell) => item.noop?.toString() || '-',
  },
  {
    id: 'errors',
    header: 'Errors',
    cell: ({ row: { original: item } }: SummaryCell) => item.error?.toString() || '-',
  },
  {
    id: 'total',
    header: 'Total',
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
        getRowId={(item) => item.resource || ''}
        pageSize={10}
      />
    </Stack>
  );
}
