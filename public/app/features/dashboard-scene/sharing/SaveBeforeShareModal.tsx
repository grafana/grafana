import { css } from '@emotion/css';
import { type ReactNode, useCallback, useEffect } from 'react';

import { Trans, t } from '@grafana/i18n';
import { Button, Modal } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

interface Props {
  dashboard: DashboardScene;
  onContinue: () => void | Promise<void>;
  title?: string;
  message?: ReactNode;
  onDismiss: () => void;
}

export function SaveBeforeShareModal({ dashboard, onContinue, onDismiss, title, message }: Props) {
  const isDirty = dashboard.state.isEditing && dashboard.state.isDirty;
  const canSave = Boolean(dashboard.state.meta.canSave);

  // Avoid showing a stale modal if the dashboard gets saved/discarded elsewhere.
  useEffect(() => {
    if (!isDirty) {
      onDismiss();
    }
  }, [isDirty, onDismiss]);

  const onCancel = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const onDiscard = useCallback(() => {
    onDismiss();
    dashboard.discardChangesAndKeepEditing();
    onContinue();
  }, [dashboard, onContinue, onDismiss]);

  const onSave = useCallback(() => {
    onDismiss();
    dashboard.openSaveDrawer({
      onSaveSuccess: () => {
        onContinue();
      },
    });
  }, [dashboard, onContinue, onDismiss]);

  const defaultTitle = t('dashboard-scene.sharing.save-before-share.title', 'Unsaved changes');
  const defaultMessage = canSave ? (
    <Trans i18nKey="dashboard-scene.sharing.save-before-share.text">
      You have unsaved changes to this dashboard. You need to save them before you can share it.
    </Trans>
  ) : (
    <Trans i18nKey="dashboard-scene.sharing.save-before-share.text-no-save">
      You have unsaved changes. You don’t have permission to save. Discard changes and share the original?
    </Trans>
  );

  if (!isDirty) {
    return null;
  }

  return (
    <Modal isOpen={true} title={title ?? defaultTitle} onDismiss={onDismiss} className={css({ width: '500px' })}>
      <h5>{message ?? defaultMessage}</h5>
      <Modal.ButtonRow>
        <Button variant="secondary" onClick={onCancel} fill="outline">
          <Trans i18nKey="common.cancel">Cancel</Trans>
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          <Trans i18nKey="common.discard">Discard</Trans>
        </Button>
        {canSave && (
          <Button onClick={onSave}>
            <Trans i18nKey="common.save">Save</Trans>
          </Button>
        )}
      </Modal.ButtonRow>
    </Modal>
  );
}
