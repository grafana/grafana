import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Button, ClipboardButton, Divider, Spinner, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import {
  useDeletePublicDashboardMutation,
  useGetPublicDashboardQuery,
  usePauseOrResumePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { NoUpsertPermissionsAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { Loader } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import {
  generatePublicDashboardUrl,
  isEmailSharingEnabled,
  PublicDashboard,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';
import { AccessControlAction } from 'app/types';

import { EmailSharing } from './EmailShare/EmailSharing';
import { PublicSharing } from './PublicShare/PublicSharing';
import ShareAlerts from './ShareAlerts';
import ShareTypeSelect from './ShareTypeSelect';

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;

export const ANYONE_WITH_THE_LINK_SHARE_OPTION = {
  label: 'Anyone with the link',
  description: 'Anyone with the link can access',
  value: PublicDashboardShareType.PUBLIC,
  icon: 'globe',
};

const SHARE_EXTERNALLY_OPTIONS = [ANYONE_WITH_THE_LINK_SHARE_OPTION];
if (isEmailSharingEnabled) {
  SHARE_EXTERNALLY_OPTIONS.unshift({
    label: 'Only specific people',
    description: 'Only people with access can open with the link',
    value: PublicDashboardShareType.EMAIL,
    icon: 'users-alt',
  });
}

export function ShareExternally({ dashboard }: { dashboard: DashboardScene }) {
  const [shareType, setShareType] = useState<SelectableValue<PublicDashboardShareType>>(SHARE_EXTERNALLY_OPTIONS[0]);
  const { data: publicDashboard, isLoading } = useGetPublicDashboardQuery(dashboard.state.uid!);

  useEffect(() => {
    if (publicDashboard && isEmailSharingEnabled) {
      const opt = SHARE_EXTERNALLY_OPTIONS.find((opt) => opt.value === publicDashboard?.share)!;
      setShareType(opt);
    }
  }, [publicDashboard]);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const onCancel = useCallback(() => {
    dashboard.closeModal();
  }, [dashboard]);

  const Config = useMemo(() => {
    if (shareType.value === PublicDashboardShareType.EMAIL && isEmailSharingEnabled) {
      return <EmailSharing dashboard={dashboard} onCancel={onCancel} />;
    }
    if (shareType.value === PublicDashboardShareType.PUBLIC) {
      return <PublicSharing dashboard={dashboard} onCancel={onCancel} />;
    }
    return <></>;
  }, [shareType, dashboard, onCancel]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Stack direction="column" gap={2} data-testid={selectors.container}>
      <ShareAlerts dashboard={dashboard} />
      <ShareTypeSelect
        dashboard={dashboard}
        setShareType={setShareType}
        value={shareType}
        options={SHARE_EXTERNALLY_OPTIONS}
      />
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode={publicDashboard ? 'edit' : 'create'} />}
      {Config}
      {publicDashboard && (
        <>
          <Divider spacing={0} />
          <Actions dashboard={dashboard} publicDashboard={publicDashboard} />
        </>
      )}
    </Stack>
  );
}
function Actions({ dashboard, publicDashboard }: { dashboard: DashboardScene; publicDashboard: PublicDashboard }) {
  const [update, { isLoading: isUpdateLoading }] = usePauseOrResumePublicDashboardMutation();
  const [deletePublicDashboard, { isLoading: isDeleteLoading }] = useDeletePublicDashboardMutation();

  const isLoading = isUpdateLoading || isDeleteLoading;
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

  const onDeleteClick = () => {
    DashboardInteractions.revokePublicDashboardClicked();
    deletePublicDashboard({
      dashboard,
      uid: publicDashboard!.uid,
      dashboardUid: dashboard.state.uid!,
    });
  };

  return (
    <Stack alignItems="center" direction={{ xs: 'column', sm: 'row' }}>
      <Stack gap={1} flex={1} direction={{ xs: 'column', sm: 'row' }}>
        <ClipboardButton
          data-testid={selectors.copyUrlButton}
          variant="primary"
          fill="outline"
          icon="link"
          disabled={!publicDashboard.isEnabled}
          getText={() => generatePublicDashboardUrl(publicDashboard!.accessToken!)}
          onClipboardCopy={onCopyURL}
        >
          Copy external link
        </ClipboardButton>
        <Button
          icon="trash-alt"
          variant="destructive"
          fill="outline"
          disabled={isLoading || !hasWritePermissions}
          onClick={onDeleteClick}
        >
          Revoke access
        </Button>
        <Button
          icon={publicDashboard.isEnabled ? 'pause' : 'play'}
          variant="secondary"
          fill="outline"
          tooltip={
            publicDashboard.isEnabled ? 'Pausing will temporarily disable access to this dashboard for all users' : ''
          }
          onClick={onPauseOrResumeClick}
          disabled={isLoading || !hasWritePermissions}
        >
          {publicDashboard.isEnabled ? 'Pause access' : 'Resume access'}
        </Button>
      </Stack>
      {isLoading && <Spinner />}
    </Stack>
  );
}
