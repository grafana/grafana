import { skipToken } from '@reduxjs/toolkit/query';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { useGetCurrentOrgQuotaQuery } from 'app/api/clients/legacy';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import {
  performInviteUserClick,
  performUpgradeUserClick,
  shouldRenderInviteUserButton,
  shouldRenderUpgradeUserButton,
} from './InviteUserButtonUtils';

export function InviteUserButton() {
  const isLargeScreen = useMediaQueryMinWidth('lg');
  const shouldRender = shouldRenderInviteUserButton();
  const shouldCheckQuota = shouldRenderUpgradeUserButton();

  // Only fetch quotas when we should check quota (Cloud instance with upgrade URL configured)
  const { data: quotas } = useGetCurrentOrgQuotaQuery(!shouldCheckQuota ? skipToken : undefined);

  // Check if org_user quota is reached
  const userQuota = quotas?.find((quota) => quota.target === 'org_user');
  const isQuotaReached =
    userQuota != null && userQuota.used != null && userQuota.limit != null && userQuota.used >= userQuota.limit;

  // Show upgrade button if: should check quota (Cloud + upgrade URL configured) AND quota is reached
  const showUpgrade = shouldCheckQuota && isQuotaReached;

  const handleClick = () => {
    try {
      if (showUpgrade) {
        performUpgradeUserClick('top_bar_right');
      } else {
        performInviteUserClick('top_bar_right', 'invite-user-top-bar');
      }
    } catch (error) {
      console.error('Failed to handle invite/upgrade user click:', error);
    }
  };

  const buttonText = showUpgrade
    ? t('navigation.invite-user.upgrade-button', 'Upgrade')
    : t('navigation.invite-user.invite-button', 'Invite');
  const tooltipText = showUpgrade
    ? t('navigation.invite-user.upgrade-tooltip', 'Upgrade to add more users')
    : t('navigation.invite-user.invite-tooltip', 'Invite user');

  return (
    shouldRender && (
      <>
        <ToolbarButton
          icon="add-user"
          iconOnly={!isLargeScreen}
          onClick={handleClick}
          tooltip={tooltipText}
          aria-label={tooltipText}
        >
          {isLargeScreen ? buttonText : undefined}
        </ToolbarButton>
        <NavToolbarSeparator />
      </>
    )
  );
}
