import { skipToken } from '@reduxjs/toolkit/query';

import { t } from '@grafana/i18n';
import { ToolbarButton } from '@grafana/ui';
import { useGetCurrentOrgQuotaQuery } from 'app/api/clients/legacy';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { isOnPrem } from 'app/features/provisioning/utils/isOnPrem';

import { NavToolbarSeparator } from '../NavToolbar/NavToolbarSeparator';

import { performInviteUserClick, performUpgradeClick, shouldRenderInviteUserButton } from './InviteUserButtonUtils';

export function InviteUserButton() {
  const isLargeScreen = useMediaQueryMinWidth('lg');
  const shouldRender = shouldRenderInviteUserButton();
  const isCloudInstance = !isOnPrem();

  // Only fetch quotas when button will render AND on Grafana Cloud
  const { data: quotas, error } = useGetCurrentOrgQuotaQuery(!shouldRender || !isCloudInstance ? skipToken : undefined);

  // Check if org_user quota is reached
  const userQuota = quotas?.find((quota) => quota.target === 'org_user');
  const isQuotaReached =
    userQuota != null && userQuota.used != null && userQuota.limit != null && userQuota.used >= userQuota.limit;

  // Only show upgrade button on Grafana Cloud when quota is reached
  const shouldShowUpgrade = isCloudInstance && isQuotaReached;

  if (error) {
    console.error('Failed to fetch org quotas:', error);
  }

  const handleClick = () => {
    try {
      if (shouldShowUpgrade) {
        performUpgradeClick('top_bar_right', 'upgrade-user-top-bar');
      } else {
        performInviteUserClick('top_bar_right', 'invite-user-top-bar');
      }
    } catch (error) {
      console.error('Failed to handle button click:', error);
    }
  };

  const buttonLabel = shouldShowUpgrade
    ? t('navigation.invite-user.upgrade-tooltip', 'Upgrade to invite more users')
    : t('navigation.invite-user.invite-tooltip', 'Invite user');

  return (
    shouldRender && (
      <>
        <ToolbarButton
          icon={shouldShowUpgrade ? 'rocket' : 'add-user'}
          iconOnly={!isLargeScreen}
          onClick={handleClick}
          tooltip={buttonLabel}
          aria-label={buttonLabel}
        >
          {isLargeScreen
            ? shouldShowUpgrade
              ? t('navigation.invite-user.upgrade-button', 'Upgrade')
              : t('navigation.invite-user.invite-button', 'Invite')
            : undefined}
        </ToolbarButton>
        <NavToolbarSeparator />
      </>
    )
  );
}
