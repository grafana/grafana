import { type ReactNode, useState } from 'react';

import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, type Column, EmptyState, InteractiveTable, LoadingPlaceholder, Stack } from '@grafana/ui';
import { AnnoKeyFolder, AnnoKeyUpdatedBy } from 'app/features/apiserver/types';

import { useFolderPath } from '../folder-browsing/folderLookups';
import { InlineRequestError } from '../shared/InlineRequestError';
import { LoadMoreFooter } from '../shared/LoadMoreFooter';

import { useDeletedByDisplayNames } from './useDeletedByDisplayNames';
import { type UseDeletedRulesResult } from './useDeletedRules';

type DeletedRule = AlertRule | RecordingRule;

interface DeletedRulesTableProps<T extends DeletedRule> {
  deleted: UseDeletedRulesResult<T>;
  /** Kind-specific columns (Recorded metric, Target data source) inserted between Title and Folder. */
  extraColumns?: Array<Column<T>>;
  /** Each page renders the Review drawer for its own rule kind. */
  renderReview: (rule: T, onClose: () => void) => ReactNode;
}

function FolderPathCell({ folderUid }: { folderUid: string | undefined }) {
  const path = useFolderPath(folderUid);
  if (!folderUid) {
    return <>{t('alerting.deleted-rules.unknown', 'Unknown')}</>;
  }
  // A folder that cannot be resolved keeps its UID rather than disabling the row.
  return <>{path?.join(' / ') || folderUid}</>;
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
  deleted,
  extraColumns = [],
  renderReview,
}: DeletedRulesTableProps<T>) {
  const { rows, isLoading, error, failure, hasMore, isLoadingMore, loadMore, retry } = deleted;
  const [ruleToReview, setRuleToReview] = useState<T | undefined>(undefined);
  const updatedByKeys = rows.map((rule) => rule.metadata.annotations?.[AnnoKeyUpdatedBy]);
  const { resolve: resolveDeletedBy } = useDeletedByDisplayNames(updatedByKeys);

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.deleted-rules.loading', 'Loading recently deleted rules...')} />;
  }

  if (error !== undefined) {
    return (
      <InlineRequestError
        title={t('alerting.deleted-rules.load-error-title', 'Unable to load recently deleted rules')}
        error={error}
        onRetry={retry}
      />
    );
  }

  if (rows.length === 0 && !failure) {
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
      <LoadMoreFooter
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        failure={failure}
        onLoadMore={loadMore}
        onRetry={retry}
      />
      {ruleToReview && renderReview(ruleToReview, () => setRuleToReview(undefined))}
    </Stack>
  );
}
