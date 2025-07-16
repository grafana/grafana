import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ToolbarButton } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { getExternalUserMngLinkUrl } from 'app/features/users/utils';
import { AccessControlAction } from 'app/types/accessControl';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

export function InviteUserButton() {
  const isLargeScreen = useMediaQueryMinWidth('lg');

  const handleClick = () => {
    try {
      reportInteraction('invite_user_button_clicked', {
        placement: 'top_bar_right',
      });

      const url = getExternalUserMngLinkUrl('invite-user-top-bar');
      window.open(url.toString(), '_blank');
    } catch (error) {
      console.error('Failed to handle invite user click:', error);
    }
  };

  const shouldRender = config.externalUserMngLinkUrl && contextSrv.hasPermission(AccessControlAction.OrgUsersAdd);

  return shouldRender ? (
    <>
      <ToolbarButton
        icon="add-user"
        iconOnly={!isLargeScreen}
        onClick={handleClick}
        tooltip={t('navigation.invite-user.invite-tooltip', 'Invite user')}
        aria-label={t('navigation.invite-user.invite-tooltip', 'Invite user')}
      >
        {isLargeScreen ? t('navigation.invite-user.invite-button', 'Invite') : undefined}
      </ToolbarButton>
      <NavToolbarSeparator />
    </>
  ) : null;
}
