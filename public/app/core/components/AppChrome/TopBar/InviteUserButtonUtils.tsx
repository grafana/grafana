import { reportInteraction, config } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

export const shouldRenderInviteUserButton = () =>
  config.featureToggles.inviteUserExperimental &&
  config.externalUserMngLinkUrl &&
  contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

export const performInviteUserClick = (placement: string, cnt: string) => {
  reportInteraction('invite_user_button_clicked', {
    placement,
  });

  const url = getExternalUserMngLinkUrl(cnt);
  window.open(url.toString(), '_blank');
};
