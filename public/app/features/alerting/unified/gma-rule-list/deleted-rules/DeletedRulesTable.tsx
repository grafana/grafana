import { useEffect, useState } from 'react';

import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Button, type Column, EmptyState, InteractiveTable, Spinner, Stack } from '@grafana/ui';

import { useFolderPath } from '../folder-browsing/folderLookups';

interface GrafanaUser {
  uid: string;
  name: string;
  login: string;
}

function useUserDisplayName(userUid: string): string {
  const [name, setName] = useState(userUid);
  useEffect(() => {
    if (!userUid) {
      return;
    }
    try {
      // /api/users/search doesn't support filtering by UID, so fetch the first
      // page of users and match by uid. Admin-only view, small user counts.
      getBackendSrv()
        .get<{ users: GrafanaUser[] }>(`/api/users/search`, { perpage: 100, page: 1 })
        .then(({ users }) => {
          const match = users.find((u) => u.uid === userUid);
          if (match) {
            setName(match.name || match.login || userUid);
          }
        })
        .catch(() => {}); // silently fall back to raw UID
    } catch {
      // backendSrv not available (e.g. in tests without MSW setup)
    }
  }, [userUid]);
  return name;
}

/** Resolves a folder UID to its full path, e.g. "Team Alerts / Subfolder". */
function FolderCell({ folderUid, fallback }: { folderUid: string; fallback: string }) {
  const path = useFolderPath(folderUid);
  return <>{path ? path.join(' / ') : fallback}</>;
}

/** Resolves a user UID to a display name. */
function UserNameCell({ userId }: { userId: string }) {
  const name = useUserDisplayName(userId);
  return <>{name}</>;
}

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
        if (folderPaths[folderUid]) {
          return <>{folderPaths[folderUid]}</>;
        }
        return <FolderCell folderUid={folderUid} fallback={folderUid} />;
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
        // Use the override map (useful in tests), or resolve inline via API
        if (userNames[uid]) {
          return userNames[uid];
        }
        return <UserNameCell userId={uid} />;
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
