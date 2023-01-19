import React, { useState, useCallback } from 'react';
import useAsync from 'react-use/lib/useAsync';

import { getBackendSrv, locationService } from '@grafana/runtime';
import { ConfirmModal, Button, LinkButton } from '@grafana/ui';

import { Snapshot } from '../types';

export function getSnapshots() {
  return getBackendSrv()
    .get('/api/dashboard/snapshots')
    .then((result: Snapshot[]) => {
      return result.map((snapshot) => ({
        ...snapshot,
        url: `/dashboard/snapshot/${snapshot.key}`,
      }));
    });
}
export const SnapshotListTable = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [removeSnapshot, setRemoveSnapshot] = useState<Snapshot | undefined>();
  const currentPath = locationService.getLocation().pathname;
  const fullUrl = window.location.href;
  const baseUrl = fullUrl.substring(0, fullUrl.indexOf(currentPath));

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
              <strong>Name</strong>
            </th>
            <th>
              <strong>Snapshot url</strong>
            </th>
            <th style={{ width: '70px' }}></th>
            <th style={{ width: '30px' }}></th>
            <th style={{ width: '25px' }}></th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => {
            const url = snapshot.externalUrl || snapshot.url;
            const fullUrl = snapshot.externalUrl || `${baseUrl}${snapshot.url}`;
            return (
              <tr key={snapshot.key}>
                <td>
                  <a href={url}>{snapshot.name}</a>
                </td>
                <td>
                  <a href={url}>{fullUrl}</a>
                </td>
                <td>{snapshot.external && <span className="query-keyword">External</span>}</td>
                <td className="text-center">
                  <LinkButton href={url} variant="secondary" size="sm" icon="eye">
                    View
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
