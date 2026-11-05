import useAsyncFn from 'react-use/lib/useAsyncFn';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { type SceneComponentProps } from '@grafana/scenes';
import { Box, Button, ClipboardButton, Field, Input, Modal, RadioButtonGroup, Stack } from '@grafana/ui';
import { getDashboardSnapshotSrv } from 'app/features/dashboard/services/SnapshotSrv';

import { type ShareSnapshotTab } from './ShareSnapshotTab';
import { getExpireOptions } from './snapshotOptions';

const selectors = e2eSelectors.pages.ShareDashboardModal.SnapshotScene;

export function ShareSnapshotTabRenderer({ model }: SceneComponentProps<ShareSnapshotTab>) {
  const { snapshotName, selectedExpireOption, modalRef, snapshotSharingOptions } = model.useState();

  const [snapshotResult, createSnapshot] = useAsyncFn(async (external = false) => {
    return model.onSnapshotCreate(external);
  });

  const [deleteSnapshotResult, deleteSnapshot] = useAsyncFn(async (key: string) => {
    return await getDashboardSnapshotSrv().deleteSnapshot(key);
  });

  // If snapshot has been deleted - show message and allow to close modal
  if (deleteSnapshotResult.value) {
    return (
      <Trans i18nKey="share-modal.snapshot.deleted-message">
        The snapshot has been deleted. If you have already accessed it once, then it might take up to an hour before
        before it is removed from browser caches or CDN caches.
      </Trans>
    );
  }

  return (
    <>
      {/* Before snapshot has been created show configuration  */}
      {!Boolean(snapshotResult.value) && (
        <>
          <div>
            <p>
              <Trans i18nKey="share-modal.snapshot.info-text-1">
                A snapshot is an instant way to share an interactive dashboard publicly. When created, we strip
                sensitive data like queries (metric, template, and annotation) and panel links, leaving only the visible
                metric data and series names embedded in your dashboard.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="share-modal.snapshot.info-text-2">
                Keep in mind, your snapshot <em>can be viewed by anyone</em> that has the link and can access the URL.
                Share wisely.
              </Trans>
            </p>
          </div>

          <Box marginBottom={2}>
            <Stack direction="column" gap={2}>
              <Field label={t('share-modal.snapshot.name', `Snapshot name`)} noMargin>
                <Input
                  id="snapshot-name-input"
                  width={30}
                  defaultValue={snapshotName}
                  onBlur={(e) => model.onSnasphotNameChange(e.target.value)}
                />
              </Field>

              <Field label={t('share-modal.snapshot.expire', `Expire`)} noMargin>
                <RadioButtonGroup<number>
                  id="expire-select-input"
                  options={getExpireOptions()}
                  value={selectedExpireOption?.value}
                  onChange={model.onExpireChange}
                />
              </Field>
            </Stack>
          </Box>

          <Modal.ButtonRow>
            <Button
              variant="secondary"
              onClick={() => {
                modalRef?.resolve().onDismiss();
              }}
              fill="outline"
            >
              <Trans i18nKey="share-modal.snapshot.cancel-button">Cancel</Trans>
            </Button>

            {snapshotSharingOptions?.externalEnabled && (
              <Button variant="secondary" disabled={snapshotResult.loading} onClick={() => createSnapshot(true)}>
                {snapshotSharingOptions?.externalSnapshotName}
              </Button>
            )}
            <Button
              variant="primary"
              disabled={snapshotResult.loading}
              onClick={() => createSnapshot()}
              data-testid={selectors.PublishSnapshot}
            >
              <Trans i18nKey="share-modal.snapshot.local-button">Publish Snapshot</Trans>
            </Button>
          </Modal.ButtonRow>
        </>
      )}

      {/* When snapshot has been created - show link and allow copy/deletion */}
      {snapshotResult.value && (
        <Stack direction="column" gap={2}>
          <Field label={t('share-modal.snapshot.url-label', 'Snapshot URL')} noMargin>
            <Input
              data-testid={selectors.CopyUrlInput}
              id="snapshot-url-input"
              value={snapshotResult.value.url}
              readOnly
              addonAfter={
                <ClipboardButton
                  data-testid={selectors.CopyUrlButton}
                  icon="copy"
                  variant="primary"
                  getText={() => snapshotResult.value!.url}
                >
                  <Trans i18nKey="share-modal.snapshot.copy-link-button">Copy</Trans>
                </ClipboardButton>
              }
            />
          </Field>

          <div style={{ alignSelf: 'flex-end', padding: '5px' }}>
            <Trans i18nKey="share-modal.snapshot.mistake-message">Did you make a mistake? </Trans>&nbsp;
            <Button
              fill="outline"
              size="md"
              variant="destructive"
              onClick={() => {
                deleteSnapshot(snapshotResult.value!.key);
              }}
            >
              <Trans i18nKey="share-modal.snapshot.delete-button">Delete snapshot.</Trans>
            </Button>
          </div>
        </Stack>
      )}
    </>
  );
}
