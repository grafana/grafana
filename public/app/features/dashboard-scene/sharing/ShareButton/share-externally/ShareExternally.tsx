import React, { useCallback, useEffect, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, featureEnabled } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, ClipboardButton, Divider, Spinner, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import {
  useDeletePublicDashboardMutation,
  useGetPublicDashboardQuery,
  useUpdatePublicDashboardMutation,
} from 'app/features/dashboard/api/publicDashboardApi';
import { NoUpsertPermissionsAlert } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { Loader } from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import {
  generatePublicDashboardUrl,
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

export interface ShareExternallyDrawerState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

const hasEmailSharingEnabled =
  !!config.featureToggles.publicDashboardsEmailSharing && featureEnabled('publicDashboardsEmailSharing');

const options = [{ label: 'Anyone with the link', value: PublicDashboardShareType.PUBLIC, icon: 'globe' }];
if (hasEmailSharingEnabled) {
  options.unshift({ label: 'Only specific people', value: PublicDashboardShareType.EMAIL, icon: 'users-alt' });
}

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareExternally;
export class ShareExternally extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

function Actions({ dashboard, publicDashboard }: { dashboard: DashboardScene; publicDashboard: PublicDashboard }) {
  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();
  const [deletePublicDashboard, { isLoading: isDeleteLoading }] = useDeletePublicDashboardMutation();

  const isLoading = isUpdateLoading || isDeleteLoading;
  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  function onCopyURL() {
    DashboardInteractions.publicDashboardUrlCopied();
  }

  const onPauseOrResumeClick = async () => {
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
    <Stack alignItems="center">
      <Stack gap={1} flex={1}>
        <ClipboardButton
          data-testid={selectors.copyUrlButton}
          variant="primary"
          fill="outline"
          icon="link"
          disabled={!publicDashboard.isEnabled}
          getText={() => generatePublicDashboardUrl(publicDashboard!.accessToken!)}
          onClipboardCopy={onCopyURL}
        >
          Copy link
        </ClipboardButton>
        <Button
          icon="trash-alt"
          variant="destructive"
          fill="outline"
          disabled={isLoading || !hasWritePermissions}
          onClick={onDeleteClick}
        >
          Remove access
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
          {publicDashboard.isEnabled ? 'Pause access' : 'Resume'}
        </Button>
      </Stack>
      {isLoading && <Spinner />}
    </Stack>
  );
}

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternally>) {
  const [shareType, setShareType] = React.useState<SelectableValue<PublicDashboardShareType>>(options[0]);
  const dashboard = model.state.dashboardRef.resolve();
  const { data: publicDashboard, isLoading } = useGetPublicDashboardQuery(dashboard.state.uid!);

  useEffect(() => {
    if (publicDashboard) {
      const opt = options.find((opt) => opt.value === publicDashboard?.share);
      setShareType(opt!);
    }
  }, [publicDashboard]);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const onCancel = useCallback(() => {
    dashboard.closeModal();
  }, [dashboard]);

  const Config = useMemo(() => {
    if (shareType.value === PublicDashboardShareType.EMAIL && hasEmailSharingEnabled) {
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
      <ShareTypeSelect dashboard={dashboard} setShareType={setShareType} value={shareType} options={options} />
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
