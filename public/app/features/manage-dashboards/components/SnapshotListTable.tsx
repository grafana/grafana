import { useState, useCallback } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Box, Button, ConfirmModal, EmptyState, ScrollContainer, Stack, TextLink } from '@grafana/ui';
import {
  getDashboardSnapshotSrv,
  type Snapshot,
  type SnapshotListOptions,
  type SnapshotListPage,
} from 'app/features/dashboard/services/SnapshotSrv';

import { SnapshotListTableRow } from './SnapshotListTableRow';

export async function getSnapshots(opts?: SnapshotListOptions): Promise<SnapshotListPage> {
  const page = await getDashboardSnapshotSrv().getSnapshots(opts);
  return {
    items: page.items.map((snapshot) => ({
      ...snapshot,
      url: `${config.appUrl}dashboard/snapshot/${snapshot.key}`,
    })),
    continueToken: page.continueToken,
  };
}

export const SnapshotListTable = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [continueToken, setContinueToken] = useState<string | undefined>();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [removeSnapshot, setRemoveSnapshot] = useState<Snapshot | undefined>();

  useAsync(async () => {
    const page = await getSnapshots();
    setSnapshots(page.items);
    setContinueToken(page.continueToken);
    setIsInitialLoading(false);
    setHasLoadedOnce(true);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !continueToken) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const page = await getSnapshots({ continue: continueToken });
      setSnapshots((prev) => [...prev, ...page.items]);
      setContinueToken(page.continueToken);
    } finally {
      setIsLoadingMore(false);
    }
  }, [continueToken, isLoadingMore]);

  const doRemoveSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      const filteredSnapshots = snapshots.filter((ss) => ss.key !== snapshot.key);
      setSnapshots(filteredSnapshots);
      await getDashboardSnapshotSrv()
        .deleteSnapshot(snapshot.key)
        .catch(() => {
          setSnapshots(snapshots);
        });
    },
    [snapshots]
  );

  if (hasLoadedOnce && snapshots.length === 0 && !continueToken) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t('snapshot.empty-state.message', "You haven't created any snapshots yet")}
      >
        <Trans i18nKey="snapshot.empty-state.more-info">
          You can create a snapshot of any dashboard through the <b>Share</b> modal.{' '}
          <TextLink
            external
            href="https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/#share-a-snapshot"
          >
            Learn more
          </TextLink>
        </Trans>
      </EmptyState>
    );
  }

  return (
    <ScrollContainer overflowY="visible" overflowX="auto" width="100%">
      <table className="filter-table">
        <thead>
          <tr>
            <th>
              <strong>
                <Trans i18nKey="snapshot.name-column-header">Name</Trans>
              </strong>
            </th>
            <th>
              <strong>
                <Trans i18nKey="snapshot.url-column-header">Snapshot url</Trans>
              </strong>
            </th>
            <th style={{ width: '70px' }}></th>
            <th style={{ width: '30px' }}></th>
            <th style={{ width: '25px' }}></th>
          </tr>
        </thead>
        <tbody>
          {isInitialLoading ? (
            <>
              <SnapshotListTableRow.Skeleton />
              <SnapshotListTableRow.Skeleton />
              <SnapshotListTableRow.Skeleton />
            </>
          ) : (
            snapshots.map((snapshot) => (
              <SnapshotListTableRow
                key={snapshot.key}
                snapshot={snapshot}
                onRemove={() => setRemoveSnapshot(snapshot)}
              />
            ))
          )}
        </tbody>
      </table>

      {!isInitialLoading && continueToken && (
        <Box paddingTop={2}>
          <Stack>
            <LoadMoreButton onClick={loadMore} loading={isLoadingMore} />
          </Stack>
        </Box>
      )}

      <ConfirmModal
        isOpen={!!removeSnapshot}
        title={t('manage-dashboards.snapshot-list-table.title-delete', 'Delete')}
        body={t(
          'manage-dashboards.snapshot-list-table.body-delete',
          "Are you sure you want to delete '{{snapshotToRemove}}'?",
          { snapshotToRemove: removeSnapshot?.name }
        )}
        confirmText={t('manage-dashboards.snapshot-list-table.confirmText-delete', 'Delete')}
        onDismiss={() => setRemoveSnapshot(undefined)}
        onConfirm={() => {
          doRemoveSnapshot(removeSnapshot!);
          setRemoveSnapshot(undefined);
        }}
      />
    </ScrollContainer>
  );
};

interface LoadMoreButtonProps {
  onClick: () => void;
  loading: boolean;
}

function LoadMoreButton({ onClick, loading }: LoadMoreButtonProps) {
  return (
    <Button
      data-testid="load-more-snapshots"
      type="button"
      variant="secondary"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Trans i18nKey="snapshot.load-more.loading">Loading more snapshots…</Trans>
      ) : (
        <Trans i18nKey="snapshot.load-more.label">Show more snapshots</Trans>
      )}
    </Button>
  );
}
