import { useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { ShareDrawerConfirmAction } from '../../ShareDrawer/ShareDrawerConfirmAction';
import { ShareSnapshotTab } from '../../ShareSnapshotTab';
import { ShareView } from '../../types';

import { CreateSnapshot } from './CreateSnapshot';
import { SnapshotActions } from './SnapshotActions';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareSnapshot;

export class ShareSnapshot extends ShareSnapshotTab implements ShareView {
  static Component = ShareSnapshotRenderer;

  public getTabLabel() {
    return t('share-dashboard.menu.share-snapshot-title', 'Share snapshot');
  }
}

function ShareSnapshotRenderer({ model }: SceneComponentProps<ShareSnapshot>) {
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showDeletedAlert, setShowDeletedAlert] = useState(false);
  const [step, setStep] = useState(1);

  const { snapshotName, snapshotSharingOptions, selectedExpireOption, panelRef, onDismiss } = model.useState();

  const [snapshotResult, createSnapshot] = useAsyncFn(async (external = false) => {
    const response = await model.onSnapshotCreate(external);
    setStep(2);
    return response;
  });
  const [deleteSnapshotResult, deleteSnapshot] = useAsyncFn(async (url: string) => {
    const response = await model.onSnapshotDelete(url);
    setStep(1);
    setShowDeleteConfirmation(false);
    setShowDeletedAlert(true);
    return response;
  });

  const onCancelClick = () => {
    onDismiss?.();
  };

  if (showDeleteConfirmation) {
    return (
      <ShareDrawerConfirmAction
        title={t('snapshot.share.delete-title', 'Delete snapshot')}
        confirmButtonLabel={t('snapshot.share.delete-button', 'Delete snapshot')}
        onConfirm={() => deleteSnapshot(snapshotResult.value?.deleteUrl!)}
        onDismiss={() => setShowDeleteConfirmation(false)}
        description={t('snapshot.share.delete-description', 'Are you sure you want to delete this snapshot?')}
        isActionLoading={deleteSnapshotResult.loading}
      />
    );
  }

  return (
    <div data-testid={selectors.container}>
      {step === 1 && (
        <>
          {showDeletedAlert && (
            <Alert severity="info" title={''} onRemove={() => setShowDeletedAlert(false)}>
              <Trans i18nKey="snapshot.share.deleted-alert">
                Your snapshot has been deleted. It might take up to an hour before the snapshot is cleared from any CDN
                caches.
              </Trans>
            </Alert>
          )}
          <CreateSnapshot
            name={snapshotName ?? ''}
            selectedExpireOption={selectedExpireOption}
            sharingOptions={snapshotSharingOptions}
            onNameChange={model.onSnasphotNameChange}
            onCancelClick={onCancelClick}
            onExpireChange={model.onExpireChange}
            onCreateClick={createSnapshot}
            isLoading={snapshotResult.loading}
            panelRef={panelRef}
          />
        </>
      )}
      {step === 2 && (
        <SnapshotActions
          url={snapshotResult.value!.url}
          onDeleteClick={() => setShowDeleteConfirmation(true)}
          onNewSnapshotClick={() => setStep(1)}
        />
      )}
    </div>
  );
}
