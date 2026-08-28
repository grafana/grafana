import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button, Icon, InteractiveTable, Modal, Stack } from '@grafana/ui';
import { type JobResourceSummary, type ResourceSyncIssue } from 'app/api/clients/provisioning/v0alpha1';

import { getKindInfoByGroupKind } from '../utils/resourceKinds';

type SummaryCell = {
  row: {
    original: JobResourceSummary;
  };
};

interface IssueModalState {
  title: string;
  messages: string[];
}

// resourceErrors/resourceWarnings are the categorized counterparts to the
// deprecated flat-string errors/warnings -- prefer them, but fall back for
// historic jobs recorded before this field existed.
function getIssueMessages(issues: ResourceSyncIssue[] | undefined, fallback: string[] | undefined): string[] {
  if (issues?.length) {
    return issues.map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message));
  }
  return fallback ?? [];
}

function CountLink({
  count,
  messages,
  title,
  onShowIssues,
}: {
  count?: number;
  messages: string[];
  title: string;
  onShowIssues: (state: IssueModalState) => void;
}) {
  const text = count?.toString() || '-';
  if (!messages.length) {
    return <span>{text}</span>;
  }
  return (
    <Button
      variant="secondary"
      fill="text"
      size="sm"
      icon="angle-right"
      iconPlacement="right"
      onClick={() => onShowIssues({ title, messages })}
    >
      {text}
    </Button>
  );
}

const getSummaryColumns = (onShowIssues: (state: IssueModalState) => void) => [
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
    cell: ({ row: { original: item } }: SummaryCell) => {
      const kind = item.kind || t('provisioning.job-summary.unknown-kind', 'Unknown');
      return (
        <CountLink
          count={item.warning}
          messages={getIssueMessages(item.resourceWarnings, item.warnings)}
          title={t('provisioning.job-summary.warnings-modal-title', '{{kind}} warnings', { kind })}
          onShowIssues={onShowIssues}
        />
      );
    },
  },
  {
    id: 'errors',
    header: t('provisioning.job-summary.column-errors', 'Errors'),
    cell: ({ row: { original: item } }: SummaryCell) => {
      const kind = item.kind || t('provisioning.job-summary.unknown-kind', 'Unknown');
      return (
        <CountLink
          count={item.error}
          messages={getIssueMessages(item.resourceErrors, item.errors)}
          title={t('provisioning.job-summary.errors-modal-title', '{{kind}} errors', { kind })}
          onShowIssues={onShowIssues}
        />
      );
    },
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
  const [issueModal, setIssueModal] = useState<IssueModalState | null>(null);

  return (
    <Stack direction="column" gap={2}>
      <InteractiveTable
        data={summary}
        columns={getSummaryColumns(setIssueModal)}
        getRowId={(item) => `${item.group ?? ''}/${item.kind ?? ''}`}
        pageSize={10}
      />
      {issueModal && (
        <Modal title={issueModal.title} isOpen onDismiss={() => setIssueModal(null)}>
          <ul>
            {issueModal.messages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </Modal>
      )}
    </Stack>
  );
}
