import { useState } from 'react';
import { useAsyncFn } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { Alert, Box, Button, Field, Stack, TextArea } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { getMessageFromError } from 'app/core/utils/errors';

import { type SaveDashboardDrawer } from '../saving/SaveDashboardDrawer';
import { type DashboardChangeInfo, SaveButton } from '../saving/shared';
import { type DashboardScene } from '../scene/DashboardScene';

import { getScenePendingChangePreview, isPendingChangesStale, previewedDashboardUid } from './pendingChangePreview';
import { pendingChangesSuperseded } from './pendingChangesHistory';
import { savePendingChanges, showSavedPendingChanges } from './pendingChangesSave';

interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

/** The version history keeps a message up to this long. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * The save form for pending changes to a saved dashboard: Save saves them through the plugin that
 * keeps them. Once someone saved the dashboard since they started, Save overwrites that save, or the
 * plugin brings them up to date.
 */
export function SavePendingChangesForm({ dashboard, drawer, changeInfo }: Props) {
  const notifyApp = useAppNotification();
  const preview = getScenePendingChangePreview(dashboard.state);
  const [message, setMessage] = useState('');
  const [stale, setStale] = useState(() => (preview ? isPendingChangesStale(preview) : false));

  const [state, onSave] = useAsyncFn(
    async (force: boolean) => {
      const result = await savePendingChanges(dashboard, { force, message });
      if (!result.saved) {
        if (result.currentGeneration !== undefined) {
          setStale(true);
        } else if (pendingChangesSuperseded(dashboard)) {
          // The pending changes changed under an edit: the page shows the newer ones instead.
          dashboard.closeModal();
        }
        // Otherwise an edit failed to record, as its own error says: Save tries it again.
        return;
      }
      const uid = previewedDashboardUid(dashboard.state);
      notifyApp.success(t('dashboard-scene.use-save-dashboard.message-dashboard-saved', 'Dashboard saved'));
      dashboard.closeModal();
      dashboard.setState({ isDirty: false });
      drawer.state.onSaveSuccess?.();
      // An embedded view's host shows the saved dashboard itself, from onSaveSuccess.
      if (uid && !dashboard.state.meta.isEmbedded) {
        await showSavedPendingChanges(dashboard, uid);
      }
    },
    [dashboard, drawer, message, notifyApp]
  );

  const messageLength = message.length;
  const messageTooLong = messageLength > MAX_MESSAGE_LENGTH;
  const saveButton = (overwrite: boolean) => (
    <SaveButton
      isValid={(changeInfo.hasChanges || overwrite) && !messageTooLong}
      isLoading={state.loading}
      onSave={onSave}
      overwrite={overwrite}
    />
  );
  const cancelButton = (
    <Button variant="secondary" onClick={drawer.onClose} fill="outline">
      <Trans i18nKey="dashboard-scene.save-dashboard-form.cancel-button.cancel">Cancel</Trans>
    </Button>
  );
  const update = preview?.pending.update;

  return (
    <Stack gap={2} direction="column">
      <Field label={t('dashboard-scene.save-dashboard-form.label-message', 'Message')} noMargin>
        <TextArea
          aria-label={t('dashboard-scene.save-dashboard-form.aria-label-message', 'message')}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          placeholder={t(
            'dashboard-scene.save-dashboard-form.placeholder-describe-changes-optional',
            'Add a note to describe your changes (optional).'
          )}
          autoFocus
          rows={5}
        />
      </Field>
      {messageTooLong && (
        <Alert title={t('save-dashboards.message-length.title', 'Message too long')} severity="error">
          <p>
            <Trans i18nKey="save-dashboards.message-length.info">
              The message is {{ messageLength }} characters, which exceeds the maximum length of 500 characters. Please
              shorten it before saving.
            </Trans>
          </p>
        </Alert>
      )}
      {state.error && (
        <Alert title={t('dashboard-scene.lifecycle.save-failed', "Couldn't save the changes")} severity="error">
          {getMessageFromError(state.error)}
        </Alert>
      )}
      {stale ? (
        <Alert
          title={t(
            'dashboard-scene.save-dashboard-form.render-footer.title-someone-else-has-updated-this-dashboard',
            'Someone else has updated this dashboard'
          )}
          severity="error"
        >
          <p>
            <Trans i18nKey="dashboard-scene.save-dashboard-form.render-footer.would-still-dashboard">
              Would you still like to save this dashboard?
            </Trans>
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {saveButton(true)}
              {update && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    drawer.onClose();
                    update();
                  }}
                >
                  <Trans i18nKey="dashboard-scene.lifecycle.ask-assistant-to-update">Ask Assistant to update</Trans>
                </Button>
              )}
              {cancelButton}
            </Stack>
          </Box>
        </Alert>
      ) : (
        <Stack alignItems="center">
          {saveButton(false)}
          {cancelButton}
          {!changeInfo.hasChanges && (
            <div>
              <Trans i18nKey="dashboard-scene.save-dashboard-form.render-footer.no-changes-to-save">
                No changes to save
              </Trans>
            </div>
          )}
        </Stack>
      )}
    </Stack>
  );
}
