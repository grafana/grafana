import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Badge, BadgeColor, IconName } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';

import { PROVISIONING_URL } from '../constants';

interface BadgeConfig {
  color: BadgeColor;
  text: string;
  icon: IconName;
  tooltip?: string;
}

function getBadgeConfig(repo: Repository): BadgeConfig {
  if (repo.metadata?.deletionTimestamp) {
    return {
      color: 'red',
      text: t('provisioning.status-badge.deleting', 'Deleting'),
      icon: 'spinner',
    };
  }

  let config: BadgeConfig;

  // Sync state takes precedence over disabled state
  if (repo.status?.sync?.state?.length) {
    switch (repo.status.sync.state) {
      case 'success':
        config = { icon: 'check', text: t('provisioning.status-badge.up-to-date', 'Up-to-date'), color: 'green' };
        break;
      case 'warning':
        config = {
          color: 'orange',
          text: t('provisioning.status-badge.warning', 'Warning'),
          icon: 'exclamation-triangle',
        };
        break;
      case 'working':
      case 'pending':
        config = { color: 'darkgrey', text: t('provisioning.status-badge.pulling', 'Pulling'), icon: 'spinner' };
        break;
      case 'error':
        config = {
          color: 'red',
          text: t('provisioning.status-badge.error', 'Error'),
          icon: 'exclamation-triangle',
        };
        break;
      default:
        config = {
          color: 'purple',
          text: t('provisioning.status-badge.unknown', 'Unknown'),
          icon: 'exclamation-triangle',
        };
        break;
    }
  } else if (!repo.spec?.sync?.enabled) {
    config = { color: 'orange', text: t('provisioning.status-badge.disabled', 'Disabled'), icon: 'info-circle' };
  } else {
    config = {
      color: 'darkgrey',
      text: t('provisioning.status-badge.pending', 'Pending'),
      icon: 'spinner',
      tooltip: t('provisioning.status-badge.waiting-for-health-check', 'Waiting for health check to run'),
    };
  }

  if (!repo.spec?.sync?.enabled) {
    config.tooltip = t(
      'provisioning.status-badge.automatic-pulling-disabled-tooltip',
      'Automatic pulling disabled. Review your connection configuration to enable pulling.'
    );
  }

  return config;
}

interface StatusBadgeProps {
  repo?: Repository;
  displayOnly?: boolean; // if true, disable click action and cursor will be default
}

export function StatusBadge({ repo, displayOnly = false }: StatusBadgeProps) {
  const handleClick = useCallback(() => {
    if (displayOnly || !repo?.metadata?.name) {
      return;
    }
    locationService.push(`${PROVISIONING_URL}/${repo.metadata.name}/?tab=overview`);
  }, [repo?.metadata?.name, displayOnly]);

  if (!repo) {
    return null;
  }

  const { color, text, icon, tooltip } = getBadgeConfig(repo);

  return (
    <Badge
      color={color}
      icon={icon}
      text={text}
      style={{ cursor: displayOnly ? 'default' : 'pointer' }}
      tooltip={tooltip}
      onClick={handleClick}
    />
  );
}
