import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useDeletePublicDashboardMutation } from 'app/features/dashboard/api/publicDashboardApi';
import { ConfigPublicDashboardBase } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ConfigPublicDashboard/ConfigPublicDashboard';
import { PublicDashboard } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { AccessControlAction } from 'app/types/accessControl';

import { shareDashboardType } from '../../../dashboard/components/ShareModal/utils';
import { getDashboardSceneFor } from '../../utils/utils';
import { ShareModal } from '../ShareModal';

import { ConfirmModal } from './ConfirmModal';
import { SharePublicDashboardTab } from './SharePublicDashboardTab';
import { useUnsupportedDatasources } from './hooks';

interface Props extends SceneComponentProps<SharePublicDashboardTab> {
  publicDashboard?: PublicDashboard;
  isGetLoading?: boolean;
}

export function ConfigPublicDashboard({ model, publicDashboard, isGetLoading }: Props) {
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const dashboard = getDashboardSceneFor(model);
  const { isDirty } = dashboard.useState();
  const [deletePublicDashboard] = useDeletePublicDashboardMutation();
  const hasTemplateVariables = (dashboard.state.$variables?.state.variables.length ?? 0) > 0;
  const unsupportedDataSources = useUnsupportedDatasources(dashboard);
  const timeRangeState = sceneGraph.getTimeRange(model);
  const timeRange = timeRangeState.useState();

  return (
    <ConfigPublicDashboardBase
      dashboard={dashboard}
      publicDashboard={publicDashboard}
      unsupportedDatasources={unsupportedDataSources}
      onRevoke={() => {
        dashboard.showModal(
          new ConfirmModal({
            isOpen: true,
            title: t('dashboard-scene.config-public-dashboard.title.revoke-public-url', 'Revoke public URL'),
            icon: 'trash-alt',
            confirmText: t(
              'dashboard-scene.config-public-dashboard.confirmText.revoke-public-url',
              'Revoke public URL'
            ),
            body: (
              <p className={styles.description}>
                <Trans i18nKey="public-dashboard.config.revoke-body">
                  Are you sure you want to revoke this URL? The dashboard will no longer be public.
                </Trans>
              </p>
            ),
            onDismiss: () => {
              dashboard.showModal(new ShareModal({ activeTab: shareDashboardType.publicDashboard }));
            },
            onConfirm: () => {
              deletePublicDashboard({ dashboard, dashboardUid: dashboard.state.uid!, uid: publicDashboard!.uid });
              dashboard.closeModal();
            },
          })
        );
      }}
      timeRange={timeRange.value}
      showSaveChangesAlert={hasWritePermissions && isDirty}
      hasTemplateVariables={hasTemplateVariables}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  description: css({
    fontSize: theme.typography.body.fontSize,
  }),
});
