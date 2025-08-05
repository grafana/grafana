import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { performInviteUserClick, shouldRenderInviteUserButton } from './InviteUserButtonUtils';

export function InviteUserButton() {
  const isLargeScreen = useMediaQueryMinWidth('lg');

  const handleClick = () => {
    try {
      performInviteUserClick('top_bar_right', 'invite-user-top-bar');
    } catch (error) {
      console.error('Failed to handle invite user click:', error);
    }
  };

  return shouldRenderInviteUserButton ? (
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
