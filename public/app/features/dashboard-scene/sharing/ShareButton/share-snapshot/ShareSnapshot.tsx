import React, { useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert } from '@grafana/ui';

import { Trans } from '../../../../../core/internationalization';
import { ShareSnapshotTab } from '../../ShareSnapshotTab';

import { CreateSnapshot } from './CreateSnapshot';
import { SnapshotActions } from './SnapshotActions';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareSnapshot;

export class ShareSnapshot extends ShareSnapshotTab {
  static Component = ShareSnapshotRenderer;
}

function ShareSnapshotRenderer({ model }: SceneComponentProps<ShareSnapshot>) {
  const [step, setStep] = useState(1);

  const [snapshotResult, createSnapshot] = useAsyncFn(async (external = false) => {
    const response = await model.onSnapshotCreate(external);
    setStep(2);
    return response;
  });

  const [deleteSnapshotResult, deleteSnapshot] = useAsyncFn(async (url: string) => {
    const response = await model.onSnapshotDelete(url);
    setStep(1);
    return response;
  });

  return (
    <div data-testid={selectors.container}>
      {step === 1 && (
        <>
          {deleteSnapshotResult.value && (
            <Alert severity="info" title={''}>
              <Trans i18nKey="snapshot.share.deleted-alert">
                The snapshot has been deleted. It may take up to an hour to clear from browser and CDN caches if already
                accessed.
              </Trans>
            </Alert>
          )}
          <CreateSnapshot onCreateClick={createSnapshot} isLoading={snapshotResult.loading} model={model} />
        </>
      )}
      {step === 2 && (
        <SnapshotActions
          url={snapshotResult.value!.url}
          isLoading={deleteSnapshotResult.loading}
          onDeleteClick={() => deleteSnapshot(snapshotResult.value?.deleteUrl!)}
          onNewSnapshotClick={() => setStep(1)}
        />
      )}
    </div>
  );
}
