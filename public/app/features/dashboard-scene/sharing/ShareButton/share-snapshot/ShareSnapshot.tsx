import { useState } from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { SceneComponentProps } from '@grafana/scenes';
import { Alert, Button, ClipboardButton, Spinner, Stack, TextLink } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';

import { SnapshotSharingOptions } from '../../../../dashboard/services/SnapshotSrv';
import { ShareDrawerConfirmAction } from '../../ShareDrawer/ShareDrawerConfirmAction';
import { ShareSnapshotTab } from '../../ShareSnapshotTab';
import { ShareView } from '../../types';

import { UpsertSnapshot } from './UpsertSnapshot';

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

  const { snapshotName, snapshotSharingOptions, selectedExpireOption, panelRef, onDismiss, dashboardRef } =
    model.useState();

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

  const reset = () => {
    model.onSnasphotNameChange(dashboardRef.resolve().state.title);
    setStep(1);
  };

  const onDeleteSnapshotClick = async () => {
    await deleteSnapshot(snapshotResult.value?.deleteUrl!);
    reset();
  };

  if (showDeleteConfirmation) {
    return (
      <ShareDrawerConfirmAction
        title={t('snapshot.share.delete-title', 'Delete snapshot')}
        confirmButtonLabel={t('snapshot.share.delete-button', 'Delete snapshot')}
        onConfirm={onDeleteSnapshotClick}
        onDismiss={() => setShowDeleteConfirmation(false)}
        description={t('snapshot.share.delete-description', 'Are you sure you want to delete this snapshot?')}
        isActionLoading={deleteSnapshotResult.loading}
      />
    );
  }

  return (
    <div data-testid={selectors.container}>
      <>
        {step === 1 && showDeletedAlert && (
          <Alert severity="info" title={''} onRemove={() => setShowDeletedAlert(false)}>
            <Trans i18nKey="snapshot.share.deleted-alert">
              Snapshot deleted. It could take an hour to be cleared from CDN caches.
            </Trans>
          </Alert>
        )}
        <UpsertSnapshot
          name={snapshotName ?? ''}
          selectedExpireOption={selectedExpireOption}
          onNameChange={model.onSnasphotNameChange}
          onExpireChange={model.onExpireChange}
          disableInputs={step === 2}
          panelRef={panelRef}
        >
          <Stack justifyContent="space-between" gap={{ xs: 2 }} direction={{ xs: 'column', xl: 'row' }}>
            {step === 1 ? (
              <CreateSnapshotActions
                onCreateClick={createSnapshot}
                isLoading={snapshotResult.loading}
                onCancelClick={onCancelClick}
                sharingOptions={snapshotSharingOptions}
              />
            ) : (
              step === 2 &&
              snapshotResult.value && (
                <UpsertSnapshotActions
                  url={snapshotResult.value!.url}
                  onDeleteClick={() => setShowDeleteConfirmation(true)}
                  onNewSnapshotClick={reset}
                />
              )
            )}
            <TextLink icon="external-link-alt" href="/dashboard/snapshots" external>
              {t('snapshot.share.view-all-button', 'View all snapshots')}
            </TextLink>
          </Stack>
        </UpsertSnapshot>
      </>
    </div>
  );
}

const CreateSnapshotActions = ({
  isLoading,
  onCreateClick,
  onCancelClick,
  sharingOptions,
}: {
  isLoading: boolean;
  sharingOptions?: SnapshotSharingOptions;
  onCancelClick: () => void;
  onCreateClick: (isExternal?: boolean) => void;
}) => (
  <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
    <Button
      variant="primary"
      disabled={isLoading}
      onClick={() => onCreateClick()}
      data-testid={selectors.publishSnapshot}
    >
      <Trans i18nKey="snapshot.share.local-button">Publish snapshot</Trans>
    </Button>
    {sharingOptions?.externalEnabled && (
      <Button variant="secondary" disabled={isLoading} onClick={() => onCreateClick(true)}>
        {sharingOptions?.externalSnapshotName}
      </Button>
    )}
    <Button variant="secondary" fill="outline" onClick={onCancelClick}>
      <Trans i18nKey="snapshot.share.cancel-button">Cancel</Trans>
    </Button>
    {isLoading && <Spinner />}
  </Stack>
);

const UpsertSnapshotActions = ({
  url,
  onDeleteClick,
  onNewSnapshotClick,
}: {
  url: string;
  onDeleteClick: () => void;
  onNewSnapshotClick: () => void;
}) => {
  const hasDeletePermission = contextSrv.hasPermission(AccessControlAction.SnapshotsDelete);
  const deleteTooltip = hasDeletePermission
    ? ''
    : t('snapshot.share.delete-permission-tooltip', "You don't have permission to delete snapshots");

  return (
    <Stack justifyContent="flex-start" gap={1} direction={{ xs: 'column', sm: 'row' }}>
      <ClipboardButton
        icon="link"
        variant="primary"
        fill="outline"
        getText={() => url}
        data-testid={selectors.copyUrlButton}
      >
        <Trans i18nKey="snapshot.share.copy-link-button">Copy link</Trans>
      </ClipboardButton>
      <Button
        icon="trash-alt"
        variant="destructive"
        fill="outline"
        onClick={onDeleteClick}
        disabled={!hasDeletePermission}
        tooltip={deleteTooltip}
      >
        <Trans i18nKey="snapshot.share.delete-button">Delete snapshot</Trans>
      </Button>
      <Button variant="secondary" fill="solid" onClick={onNewSnapshotClick}>
        <Trans i18nKey="snapshot.share.new-snapshot-button">New snapshot</Trans>
      </Button>
    </Stack>
  );
};
