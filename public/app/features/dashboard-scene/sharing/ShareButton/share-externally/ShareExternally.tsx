import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Button, ClipboardButton, Divider, Spinner, Stack, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import {
  useDeletePublicDashboardMutation,
  useGetPublicDashboardQuery,
  usePauseOrResumePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { Loader } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import {
  generatePublicDashboardUrl,
  isEmailSharingEnabled,
  PublicDashboard,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { getDashboardSceneFor } from 'app/features/dashboard-scene/utils/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { ShareDrawerConfirmAction } from '../../ShareDrawer/ShareDrawerConfirmAction';
import { useShareDrawerContext } from '../../ShareDrawer/ShareDrawerContext';
import { SceneShareTabState, ShareView } from '../../types';

import { EmailSharing } from './EmailShare/EmailSharing';
import { PublicSharing } from './PublicShare/PublicSharing';
import ShareAlerts from './ShareAlerts';
import ShareTypeSelect from './ShareTypeSelect';
import { getAnyOneWithTheLinkShareOption, getOnlySpecificPeopleShareOption } from './utils';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;

const getShareExternallyOptions = () => {
  return isEmailSharingEnabled()
    ? [getOnlySpecificPeopleShareOption(), getAnyOneWithTheLinkShareOption()]
    : [getAnyOneWithTheLinkShareOption()];
};

export class ShareExternally extends SceneObjectBase<SceneShareTabState> implements ShareView {
  static Component = ShareExternallyRenderer;

  public getTabLabel() {
    return t('share-dashboard.menu.share-externally-title', 'Share externally');
  }
}

function ShareExternallyRenderer({ model }: SceneComponentProps<ShareExternally>) {
  const [showRevokeAccess, setShowRevokeAccess] = useState(false);

  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);

  const { data: publicDashboard, isLoading } = useGetPublicDashboardQuery(dashboard.state.uid!);
  const [deletePublicDashboard, { isLoading: isDeleteLoading }] = useDeletePublicDashboardMutation();

  const onRevokeClick = () => {
    setShowRevokeAccess(true);
  };

  const onDeleteClick = async () => {
    DashboardInteractions.revokePublicDashboardClicked();
    await deletePublicDashboard({
      dashboard,
      uid: publicDashboard!.uid,
      dashboardUid: dashboard.state.uid!,
    }).unwrap();
    setShowRevokeAccess(false);
  };

  if (isLoading) {
    return <Loader />;
  }

  if (showRevokeAccess) {
    return (
      <ShareDrawerConfirmAction
        title={t('public-dashboard.share-externally.revoke-access-button', 'Revoke access')}
        confirmButtonLabel={t('public-dashboard.share-externally.revoke-access-button', 'Revoke access')}
        onConfirm={onDeleteClick}
        onDismiss={() => setShowRevokeAccess(false)}
        description={t(
          'public-dashboard.share-externally.revoke-access-description',
          'Are you sure you want to revoke this access? The dashboard can no longer be shared.'
        )}
        isActionLoading={isDeleteLoading}
      />
    );
  }

  return (
    <div className={styles.container}>
      <ShareExternallyBase publicDashboard={publicDashboard} onRevokeClick={onRevokeClick} />
    </div>
  );
}

function ShareExternallyBase({
  publicDashboard,
  onRevokeClick,
}: {
  publicDashboard?: PublicDashboard;
  onRevokeClick: () => void;
}) {
  const options = getShareExternallyOptions();
  const getShareType = useMemo(() => {
    if (publicDashboard && isEmailSharingEnabled()) {
      const opt = options.find((opt) => opt.value === publicDashboard?.share)!;
      return opt ?? options[0];
    }

    return options[0];
  }, [publicDashboard, options]);

  const [shareType, setShareType] = useState<SelectableValue<PublicDashboardShareType>>(getShareType);

  const Config = useMemo(() => {
    if (shareType.value === PublicDashboardShareType.EMAIL && isEmailSharingEnabled()) {
      return <EmailSharing />;
    }

    return <PublicSharing />;
  }, [shareType]);

  return (
    <Stack direction="column" gap={2} data-testid={selectors.container}>
      <ShareAlerts publicDashboard={publicDashboard} />
      <ShareTypeSelect setShareType={setShareType} value={shareType} options={options} />
      {Config}
      {publicDashboard && (
        <>
          <Divider spacing={0} />
          <Actions publicDashboard={publicDashboard} onRevokeClick={onRevokeClick} />
        </>
      )}
    </Stack>
  );
}
function Actions({ publicDashboard, onRevokeClick }: { publicDashboard: PublicDashboard; onRevokeClick: () => void }) {
  const { dashboard } = useShareDrawerContext();
  const [update, { isLoading: isUpdateLoading }] = usePauseOrResumePublicDashboardMutation();
  const styles = useStyles2(getStyles);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  function onCopyURL() {
    DashboardInteractions.publicDashboardUrlCopied();
  }

  const onPauseOrResumeClick = async () => {
    DashboardInteractions.publicDashboardPauseSharingClicked({
      paused: !publicDashboard.isEnabled,
    });
    update({
      dashboard: dashboard,
      payload: {
        ...publicDashboard!,
        isEnabled: !publicDashboard.isEnabled,
      },
    });
  };

  return (
    <Stack alignItems="center" direction={{ xs: 'column', sm: 'row' }}>
      <div className={styles.actionsContainer}>
        <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
          <ClipboardButton
            data-testid={selectors.Configuration.copyUrlButton}
            variant="primary"
            fill="outline"
            icon="link"
            getText={() => generatePublicDashboardUrl(publicDashboard!.accessToken!)}
            onClipboardCopy={onCopyURL}
          >
            <Trans i18nKey="public-dashboard.share-externally.copy-link-button">Copy external link</Trans>
          </ClipboardButton>
          <Button
            icon="trash-alt"
            variant="destructive"
            fill="outline"
            disabled={isUpdateLoading || !hasWritePermissions}
            onClick={onRevokeClick}
            data-testid={selectors.Configuration.revokeAccessButton}
          >
            <Trans i18nKey="public-dashboard.share-externally.revoke-access-button">Revoke access</Trans>
          </Button>
          <Button
            icon={publicDashboard.isEnabled ? 'pause' : 'play'}
            variant="secondary"
            fill="outline"
            tooltip={
              publicDashboard.isEnabled
                ? t(
                    'public-dashboard.share-externally.pause-access-tooltip',
                    'Pausing will temporarily disable access to this dashboard for all users'
                  )
                : ''
            }
            onClick={onPauseOrResumeClick}
            disabled={isUpdateLoading || !hasWritePermissions}
            data-testid={selectors.Configuration.toggleAccessButton}
          >
            {publicDashboard.isEnabled ? (
              <Trans i18nKey="public-dashboard.share-externally.pause-access-button">Pause access</Trans>
            ) : (
              <Trans i18nKey="public-dashboard.share-externally.resume-access-button">Resume access</Trans>
            )}
          </Button>
        </Stack>
      </div>
      {isUpdateLoading && <Spinner />}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    paddingBottom: theme.spacing(2),
  }),
  actionsContainer: css({
    width: '100%',
  }),
});
