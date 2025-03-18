import { useState, useCallback } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { config } from '@grafana/runtime';
import { ConfirmModal, EmptyState, TextLink } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { getDashboardSnapshotSrv, Snapshot } from 'app/features/dashboard/services/SnapshotSrv';

import { SnapshotListTableRow } from './SnapshotListTableRow';

export async function getSnapshots() {
  return getDashboardSnapshotSrv()
    .getSnapshots()
    .then((result: Snapshot[]) => {
      return result.map((snapshot) => ({
        ...snapshot,
        url: `${config.appUrl}dashboard/snapshot/${snapshot.key}`,
      }));
    });
}
export const SnapshotListTable = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [removeSnapshot, setRemoveSnapshot] = useState<Snapshot | undefined>();
  useAsync(async () => {
    setIsFetching(true);
    const response = await getSnapshots();
    setIsFetching(false);
    setSnapshots(response);
  }, [setSnapshots]);

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

  if (!isFetching && snapshots.length === 0) {
    return (
      <EmptyState
        variant="call-to-action"
        message={t('snapshot.empty-state.message', "You haven't created any snapshots yet")}
      >
        <Trans i18nKey="snapshot.empty-state.more-info">
          You can create a snapshot of any dashboard through the <b>Share</b> modal.{' '}
          <TextLink
            external
            href="https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/#publish-a-snapshot"
          >
            Learn more
          </TextLink>
        </Trans>
      </EmptyState>
    );
  }

  return (
    <div>
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
          {isFetching ? (
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

      <ConfirmModal
        isOpen={!!removeSnapshot}
        icon="trash-alt"
        title="Delete"
        body={`Are you sure you want to delete '${removeSnapshot?.name}'?`}
        confirmText="Delete"
        onDismiss={() => setRemoveSnapshot(undefined)}
        onConfirm={() => {
          doRemoveSnapshot(removeSnapshot!);
          setRemoveSnapshot(undefined);
        }}
      />
    </div>
  );
};
