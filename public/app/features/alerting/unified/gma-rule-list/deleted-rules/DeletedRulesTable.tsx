import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Button, type Column, EmptyState, InteractiveTable, Spinner, Stack } from '@grafana/ui';

interface DeletedRulesTableProps {
  rules: AlertRule[];
  /** Pre-resolved folder paths: uid → display path string */
  folderPaths: Record<string, string>;
  /** Pre-resolved user names: uid → display name; fallback to uid */
  userNames: Record<string, string>;
  onReview: (rule: AlertRule) => void;
  onRestore: (rule: AlertRule) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
}

export function DeletedRulesTable({
  rules,
  folderPaths,
  userNames,
  onReview,
  onRestore,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: DeletedRulesTableProps) {
  if (rules.length === 0) {
    return (
      <EmptyState
        variant="not-found"
        message={t('alerting.recently-deleted.empty', 'No recently deleted rules found')}
      />
    );
  }

  const columns: Array<Column<AlertRule>> = [
    {
      id: 'title',
      header: t('alerting.recently-deleted.table.title', 'Title'),
      cell: ({ row }) => row.original.spec?.title ?? '',
    },
    {
      id: 'folder',
      header: t('alerting.recently-deleted.table.folder', 'Folder'),
      cell: ({ row }) => {
        const folderUid = row.original.metadata?.annotations?.['grafana.app/folder'];
        if (!folderUid) {
          return null;
        }
        return <>{folderPaths[folderUid] ?? folderUid}</>;
      },
    },
    {
      id: 'deleted',
      header: t('alerting.recently-deleted.table.deleted', 'Deleted'),
      cell: ({ row }) => {
        const ts = row.original.metadata?.deletionTimestamp;
        if (!ts) {
          return null;
        }
        return (
          <Stack direction="column" gap={0}>
            <span>{dateTimeFormat(ts)}</span>
            <span>{dateTimeFormatTimeAgo(ts)}</span>
          </Stack>
        );
      },
    },
    {
      id: 'deletedBy',
      header: t('alerting.recently-deleted.table.deleted-by', 'Deleted by'),
      cell: ({ row }) => {
        const uid = row.original.metadata?.annotations?.['grafana.app/updatedBy'];
        if (!uid) {
          return t('alerting.recently-deleted.unknown', 'Unknown');
        }
        return userNames[uid] ?? uid;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Stack direction="row" gap={1}>
          <Button size="sm" variant="secondary" onClick={() => onReview(row.original)}>
            <Trans i18nKey="alerting.recently-deleted.action.review">Review</Trans>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onRestore(row.original)}>
            <Trans i18nKey="alerting.recently-deleted.action.restore">Restore</Trans>
          </Button>
        </Stack>
      ),
    },
  ];

  return (
    <Stack direction="column" gap={2}>
      <InteractiveTable columns={columns} data={rules} getRowId={(rule) => rule.metadata?.name ?? ''} />
      {hasMore && (
        <Button variant="secondary" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? <Spinner /> : <Trans i18nKey="alerting.recently-deleted.load-more">Load more</Trans>}
        </Button>
      )}
    </Stack>
  );
}
