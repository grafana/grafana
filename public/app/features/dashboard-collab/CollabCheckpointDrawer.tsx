/**
 * CollabCheckpointDrawer — simplified save dialog for collab mode.
 *
 * Replaces the standard SaveDashboardDrawer when collaboration is active.
 * Shows only a "Version name" text field (optional) and a Save button.
 * Sends a checkpoint op through the ops channel; the server triggers an
 * immediate save with version_type=manual.
 */

import { useState } from 'react';

import { Trans, t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, SceneObjectRef } from '@grafana/scenes';
import { Button, Drawer, Field, Input, Stack } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

import { useCollab } from './useCollab';

interface CollabCheckpointDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class CollabCheckpointDrawer extends SceneObjectBase<CollabCheckpointDrawerState> {
  public onClose = () => {
    const dashboard = this.state.dashboardRef.resolve();
    dashboard.setState({ overlay: undefined });
  };

  static Component = CollabCheckpointDrawerComponent;
}

function CollabCheckpointDrawerComponent({ model }: SceneComponentProps<CollabCheckpointDrawer>) {
  const { sendCheckpoint, connected } = useCollab();
  const notifyApp = useAppNotification();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const dashboard = model.state.dashboardRef.resolve();

  const onSave = () => {
    if (!connected) {
      notifyApp.warning(
        t('dashboard-collab.checkpoint.not-connected-title', 'Not connected'),
        t('dashboard-collab.checkpoint.not-connected-message', 'Collaboration session is not active')
      );
      return;
    }

    setSaving(true);
    sendCheckpoint(message || undefined);

    // The server handles saving asynchronously. Close the drawer and show confirmation.
    notifyApp.success(
      t('dashboard-collab.checkpoint.saved-title', 'Version saved'),
      message
        ? t('dashboard-collab.checkpoint.saved-message-named', 'Checkpoint "{{name}}" created', { name: message })
        : t('dashboard-collab.checkpoint.saved-message', 'Checkpoint created')
    );

    model.onClose();
  };

  return (
    <Drawer
      title={t('dashboard-collab.checkpoint.title', 'Save version')}
      subtitle={dashboard.state.title}
      onClose={model.onClose}
    >
      <Stack gap={2} direction="column">
        <Field
          label={t('dashboard-collab.checkpoint.version-name-label', 'Version name')}
          description={t(
            'dashboard-collab.checkpoint.version-name-description',
            'Optional name for this version. Leave blank for an unnamed checkpoint.'
          )}
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.currentTarget.value)}
            placeholder={t('dashboard-collab.checkpoint.version-name-placeholder', 'e.g. Added latency panel')}
            autoFocus
            data-testid="collab-checkpoint-message"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave();
              }
            }}
          />
        </Field>
        <Stack alignItems="center">
          <Button
            variant="secondary"
            onClick={model.onClose}
            fill="outline"
          >
            <Trans i18nKey="dashboard-collab.checkpoint.cancel">Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            disabled={saving || !connected}
            data-testid="collab-checkpoint-save"
          >
            <Trans i18nKey="dashboard-collab.checkpoint.save">Save version</Trans>
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
