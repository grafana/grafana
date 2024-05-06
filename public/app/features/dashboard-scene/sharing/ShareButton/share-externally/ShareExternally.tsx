import React, { useEffect } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { config, featureEnabled } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Button, ClipboardButton, Divider, Spinner, Stack } from '@grafana/ui';
import {
  generatePublicDashboardUrl,
  PublicDashboard,
  PublicDashboardShareType,
} from 'app/features/dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboardUtils';

import { contextSrv } from '../../../../../core/services/context_srv';
import { AccessControlAction } from '../../../../../types';
import {
  useGetPublicDashboardQuery,
  useUpdatePublicDashboardMutation,
} from '../../../../dashboard/api/publicDashboardApi';
import { NoUpsertPermissionsAlert } from '../../../../dashboard/components/ShareModal/SharePublicDashboard/ModalAlerts/NoUpsertPermissionsAlert';
import { Loader } from '../../../../dashboard/components/ShareModal/SharePublicDashboard/SharePublicDashboard';
import { DashboardScene } from '../../../scene/DashboardScene';
import { DashboardInteractions } from '../../../utils/interactions';

import { EmailSharing } from './EmailShare/EmailSharing';
import { PublicConfiguration } from './PublicShare/PublicConfiguration';
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

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;
export class ShareExternally extends SceneObjectBase<ShareExternallyDrawerState> {
  static Component = ShareExternallyDrawerRenderer;

  constructor(state: ShareExternallyDrawerState) {
    super(state);
  }
}

function Actions({ dashboard, publicDashboard }: { dashboard: DashboardScene; publicDashboard: PublicDashboard }) {
  const [update, { isLoading: isUpdateLoading }] = useUpdatePublicDashboardMutation();

  const isLoading = isUpdateLoading;

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

  // const onDeleteClick = (onDelete: () => void) => {
  //   deletePublicDashboard({
  //     dashboard,
  //     uid: publicDashboard!.uid,
  //     dashboardUid: dashboard.state.uid!,
  //   });
  //   onDelete();
  // };

  return (
    <Stack alignItems="center">
      <Stack gap={1} flex={1}>
        <ClipboardButton
          data-testid={selectors.CopyUrlButton}
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
          disabled={isLoading}
          // onClick={() => dashboard.showModal(new RevokeModal({ dashboard, publicDashboard }))}
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
          disabled={isLoading}
        >
          {publicDashboard.isEnabled ? 'Pause access' : 'Resume'}
        </Button>
      </Stack>
      {isLoading && <Spinner />}
    </Stack>
  );
}

function ShareExternallyDrawerRenderer({ model }: SceneComponentProps<ShareExternally>) {
  const [value, setValue] = React.useState<SelectableValue<PublicDashboardShareType>>(options[0]);
  const dashboard = model.state.dashboardRef.resolve();
  const { data: publicDashboard, isLoading } = useGetPublicDashboardQuery(dashboard.state.uid!);

  useEffect(() => {
    if (publicDashboard) {
      const opt = options.find((opt) => opt.value === publicDashboard?.share);
      setValue(opt!);
    }
  }, [publicDashboard]);

  const hasWritePermissions = contextSrv.hasPermission(AccessControlAction.DashboardsPublicWrite);

  const onCancel = () => {
    dashboard.closeModal();
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <Stack direction="column" gap={2}>
      <ShareTypeSelect dashboard={dashboard} setShareType={setValue} value={value} options={options} />
      {!hasWritePermissions && <NoUpsertPermissionsAlert mode={publicDashboard ? 'edit' : 'create'} />}
      {hasEmailSharingEnabled && value.value === PublicDashboardShareType.EMAIL && (
        <EmailSharing dashboard={dashboard} onCancel={onCancel} />
      )}
      {value.value === PublicDashboardShareType.PUBLIC && <PublicConfiguration onCancel={onCancel} />}
      {publicDashboard && (
        <>
          <Divider spacing={0} />
          <Actions dashboard={dashboard} publicDashboard={publicDashboard} />
        </>
      )}
    </Stack>
  );
}
