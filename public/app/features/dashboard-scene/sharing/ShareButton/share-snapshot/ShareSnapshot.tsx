import React from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { getBackendSrv } from '@grafana/runtime';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert } from '@grafana/ui';

import { ShareSnapshotTab } from '../../ShareSnapshotTab';

import { CreateSnapshot } from './CreateSnapshot';
import { SnapshotActions } from './SnapshotActions';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareSnapshot;

export class ShareSnapshot extends ShareSnapshotTab {
  static Component = ShareSnapshotRenderer;
}

function ShareSnapshotRenderer({ model }: SceneComponentProps<ShareSnapshot>) {
  const [snapshotResult, createSnapshot] = useAsyncFn(async (external = false) => {
    return model.onSnapshotCreate(external);
  });

  const [deleteSnapshotResult, deleteSnapshot] = useAsyncFn(async (url: string) => {
    return await getBackendSrv().get(url);
  });

  return (
    <div data-testid={selectors.container}>
      {!snapshotResult.value || deleteSnapshotResult.value ? (
        <>
          {deleteSnapshotResult.value && (
            <Alert severity="info" title={''}>
              The snapshot has been deleted. It may take up to an hour to clear from browser and CDN caches if already
              accessed.
            </Alert>
          )}
          <CreateSnapshot onCreateClick={createSnapshot} isLoading={snapshotResult.loading} model={model} />
        </>
      ) : (
        <SnapshotActions
          url={snapshotResult.value.url}
          onDeleteClick={() => deleteSnapshot(snapshotResult.value?.deleteUrl!)}
          isLoading={deleteSnapshotResult.loading}
        />
      )}
    </div>
  );
}
