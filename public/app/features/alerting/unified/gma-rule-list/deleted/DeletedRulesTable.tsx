import { type ReactNode, useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, type Column, EmptyState, InteractiveTable, LoadingPlaceholder, Stack } from '@grafana/ui';
import { AnnoKeyFolder, AnnoKeyUpdatedBy } from 'app/features/apiserver/types';

import { useDeletedByDisplayNames } from './useDeletedByDisplayNames';
import { useFolderPath } from './useFolderPath';

type DeletedRule = AlertRule | RecordingRule;

interface DeletedRulesTableProps<T extends DeletedRule> {
  rows: T[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error?: unknown;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreError?: unknown;
  onLoadMore: () => void;
  /** Kind-specific columns (Recorded metric, Target data source) inserted between Title and Folder. */
  extraColumns?: Array<Column<T>>;
  /** Each page renders the Review drawer for its own rule kind. */
  renderReview: (rule: T, onClose: () => void) => ReactNode;
}

function FolderPathCell({ folderUid }: { folderUid: string | undefined }) {
  const { path } = useFolderPath(folderUid);
  if (!folderUid) {
    return <>{t('alerting.deleted-rules.unknown', 'Unknown')}</>;
  }
  return <>{path ?? folderUid}</>;
}

function DeletedByCell({
  updatedBy,
  resolve,
}: {
  updatedBy: string | undefined;
  resolve: (uid?: string) => string | undefined;
}) {
  if (!updatedBy) {
    return <>{t('alerting.deleted-rules.unknown', 'Unknown')}</>;
  }
  return <>{resolve(updatedBy) ?? updatedBy}</>;
}

export function DeletedRulesTable<T extends DeletedRule>({
  rows,
  status,
  error,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  extraColumns = [],
  renderReview,
}: DeletedRulesTableProps<T>) {
  const [ruleToReview, setRuleToReview] = useState<T | undefined>(undefined);
  const updatedByKeys = rows.map((rule) => rule.metadata.annotations?.[AnnoKeyUpdatedBy]);
  const { resolve: resolveDeletedBy } = useDeletedByDisplayNames(updatedByKeys);

  if (status === 'loading') {
    return <LoadingPlaceholder text={t('alerting.deleted-rules.loading', 'Loading recently deleted rules...')} />;
  }

  if (status === 'error') {
    return (
      <Alert
        title={t('alerting.deleted-rules.load-error-title', 'Unable to load recently deleted rules')}
        severity="error"
      >
        {stringifyError(error)}
      </Alert>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.deleted-rules.empty-state-title', 'No recently deleted rules found')}
      />
    );
  }

  const columns: Array<Column<T>> = [
    {
      id: 'title',
      header: t('alerting.deleted-rules.table.title', 'Title'),
      cell: ({ row }) => row.original.spec.title,
    },
    ...extraColumns,
    {
      id: 'folder',
      header: t('alerting.deleted-rules.table.folder', 'Folder'),
      cell: ({ row }) => <FolderPathCell folderUid={row.original.metadata.annotations?.[AnnoKeyFolder]} />,
    },
    {
      id: 'deleted',
      header: t('alerting.deleted-rules.table.deleted', 'Deleted'),
      cell: ({ row }) => {
        const value = row.original.metadata.deletionTimestamp;
        if (!value) {
          return t('alerting.deleted-rules.unknown', 'Unknown');
        }
        return `${dateTimeFormat(value)} (${dateTimeFormatTimeAgo(value)})`;
      },
    },
    {
      id: 'deletedBy',
      header: t('alerting.deleted-rules.table.deleted-by', 'Deleted by'),
      cell: ({ row }) => (
        <DeletedByCell updatedBy={row.original.metadata.annotations?.[AnnoKeyUpdatedBy]} resolve={resolveDeletedBy} />
      ),
    },
    {
      id: 'actions',
      header: '',
      disableGrow: true,
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" onClick={() => setRuleToReview(row.original)}>
          <Trans i18nKey="alerting.deleted-rules.review">Review</Trans>
        </Button>
      ),
    },
  ];

  return (
    <Stack direction="column" gap={2}>
      <InteractiveTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.metadata.name ?? ''}
        pageSize={rows.length || 1}
      />
      {loadMoreError !== undefined && (
        <Alert
          title={t('alerting.deleted-rules.load-more-error-title', 'Unable to load more recently deleted rules')}
          severity="warning"
        >
          {stringifyError(loadMoreError)}
        </Alert>
      )}
      {hasMore && (
        <Stack justifyContent="flex-start">
          <Button
            variant="secondary"
            disabled={isLoadingMore}
            icon={isLoadingMore ? 'spinner' : undefined}
            onClick={onLoadMore}
          >
            <Trans i18nKey="alerting.deleted-rules.load-more">Load more</Trans>
          </Button>
        </Stack>
      )}
      {ruleToReview && renderReview(ruleToReview, () => setRuleToReview(undefined))}
    </Stack>
  );
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return t('alerting.deleted-rules.unknown-error', 'Something went wrong. Please try again.');
}
