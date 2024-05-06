import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { ConfirmModalProps, useStyles2 } from '@grafana/ui';
import { useDeletePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';

import { PublicDashboard } from '../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from '../../scene/DashboardScene';
import { ModalSceneObjectLike } from '../types';

import { ConfirmModal } from './ConfirmModal';

interface RevokeModalState extends Partial<ConfirmModalProps>, SceneObjectState {
  dashboard: DashboardScene;
  publicDashboard: PublicDashboard;
}

export class RevokeModal extends SceneObjectBase<RevokeModalState> implements ModalSceneObjectLike {
  static Component = RevokeModalRenderer;

  onDismiss = () => {
    this.state.dashboard.closeModal();
  };

  onConfirm = () => {
    this.state.dashboard.closeModal();
  };
}

function RevokeModalRenderer({ model }: SceneComponentProps<RevokeModal>) {
  const styles = useStyles2(getStyles);
  const { dashboard, publicDashboard, onConfirm, onDismiss } = model.useState();

  const [deletePublicDashboard] = useDeletePublicDashboardMutation();

  return new ConfirmModal({
    isOpen: true,
    title: 'Revoke public URL',
    icon: 'trash-alt',
    confirmText: 'Revoke public URL',
    body: (
      <p className={styles.description}>
        Are you sure you want to revoke this URL? The dashboard will no longer be public.
      </p>
    ),
    onDismiss: () => {
      onDismiss!();
    },
    onConfirm: async () => {
      await deletePublicDashboard({ dashboard, dashboardUid: dashboard.state.uid!, uid: publicDashboard!.uid });
      onConfirm!();
    },
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    fontSize: theme.typography.body.fontSize,
  }),
});
