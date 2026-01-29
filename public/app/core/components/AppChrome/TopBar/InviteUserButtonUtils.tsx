import { reportInteraction, config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { isOnPrem } from 'app/features/provisioning/utils/isOnPrem';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

export const shouldRenderInviteUserButton = () =>
  (config.externalUserMngLinkUrl || config.externalUserUpgradeLinkUrl) &&
  contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

export const shouldRenderUpgradeUserButton = () =>
  config.externalUserUpgradeLinkUrl && !isOnPrem() && contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

export const performInviteUserClick = (placement: string, cnt: string) => {
  reportInteraction('invite_user_button_clicked', {
    placement,
  });

  const url = getExternalUserMngLinkUrl(cnt);
  window.open(url.toString(), '_blank');
};

export const performUpgradeUserClick = (placement: string) => {
  reportInteraction('upgrade_user_button_clicked', {
    placement,
  });

  window.open(config.externalUserUpgradeLinkUrl, '_blank');
};
