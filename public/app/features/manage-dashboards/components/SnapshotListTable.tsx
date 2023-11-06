import React, { useState, useCallback } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { getBackendSrv, config } from '@grafana/runtime';
import { ConfirmModal, Button, LinkButton } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { Snapshot } from '../types';

export function getSnapshots() {
  return getBackendSrv()
    .get('/api/dashboard/snapshots')
    .then((result: Snapshot[]) => {
      return result.map((snapshot) => ({
        ...snapshot,
        url: `${config.appUrl}dashboard/snapshot/${snapshot.key}`,
      }));
    });
}
export const SnapshotListTable = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [removeSnapshot, setRemoveSnapshot] = useState<Snapshot | undefined>();
  useAsync(async () => {
    const response = await getSnapshots();
    setSnapshots(response);
  }, [setSnapshots]);

  const doRemoveSnapshot = useCallback(
    async (snapshot: Snapshot) => {
      const filteredSnapshots = snapshots.filter((ss) => ss.key !== snapshot.key);
      setSnapshots(filteredSnapshots);
      await getBackendSrv()
        .delete(`/api/snapshots/${snapshot.key}`)
        .catch(() => {
          setSnapshots(snapshots);
        });
    },
    [snapshots]
  );

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
          {snapshots.map((snapshot) => {
            const url = snapshot.externalUrl || snapshot.url;
            return (
              <tr key={snapshot.key}>
                <td>
                  <a href={url}>{snapshot.name}</a>
                </td>
                <td>
                  <a href={url}>{url}</a>
                </td>
                <td>
                  {snapshot.external && (
                    <span className="query-keyword">
                      <Trans i18nKey="snapshot.external-badge">External</Trans>
                    </span>
                  )}
                </td>
                <td className="text-center">
                  <LinkButton href={url} variant="secondary" size="sm" icon="eye">
                    <Trans i18nKey="snapshot.view-button">View</Trans>
                  </LinkButton>
                </td>
                <td className="text-right">
                  <Button variant="destructive" size="sm" icon="times" onClick={() => setRemoveSnapshot(snapshot)} />
                </td>
              </tr>
            );
          })}
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
