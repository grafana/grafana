import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { useAssistant } from '@grafana/assistant';
import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dropdown, Menu, Tooltip } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import MoreButton from '../components/MoreButton';
import { DeclareIncidentMenuItem } from '../components/bridges/DeclareIncidentButton';
import { useCanCreateSilences, useCanViewContactPoints } from '../hooks/useAbilities';
import { isLocalDevEnv, isOpenSourceEdition, makeLabelBasedSilenceLink } from '../utils/misc';
import { createRelativeUrl } from '../utils/url';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface NotificationActionsMenuProps {
  notification: NotificationEntry;
}

export function NotificationActionsMenu({ notification }: NotificationActionsMenuProps) {
  const { isAvailable: isAssistantAvailable, openAssistant } = useAssistant();
  const canViewContactPoint = useCanViewContactPoints();
  const canSilence = useCanCreateSilences();

  const shouldShowDeclareIncident = !isOpenSourceEdition() || isLocalDevEnv();

  const hasSilenceableLabels = notification.groupLabels && Object.keys(notification.groupLabels).length > 0;

  const ruleUIDs = notification.ruleUIDs ?? [];

  const menuItems = (
    <>
      {canViewContactPoint ? (
        <Menu.Item
          label={t('alerting.notification-detail.menu-view-contact-point', 'View contact point')}
          icon="at"
          url={createRelativeUrl(`/alerting/notifications?search=${encodeURIComponent(notification.receiver)}`)}
        />
      ) : (
        <Tooltip
          content={t(
            'alerting.notification-detail.menu-view-contact-point-no-permission',
            'You do not have permission to view contact points'
          )}
        >
          <Menu.Item
            label={t('alerting.notification-detail.menu-view-contact-point', 'View contact point')}
            icon="at"
            disabled
          />
        </Tooltip>
      )}
      {ruleUIDs.length === 1 && (
        <Menu.Item
          label={t('alerting.notification-detail.menu-view-rule', 'View alert rule')}
          icon="bell"
          url={`/alerting/grafana/${ruleUIDs[0]}/view`}
        />
      )}
      {ruleUIDs.length > 1 &&
        ruleUIDs.map((uid, index) => (
          <Menu.Item
            key={uid}
            label={t('alerting.notification-detail.menu-view-rule-n', 'View alert rule ({{n}})', {
              n: index + 1,
            })}
            icon="bell"
            url={`/alerting/grafana/${uid}/view`}
          />
        ))}
      <Menu.Divider />
      {hasSilenceableLabels &&
        (canSilence ? (
          <Menu.Item
            label={t('alerting.notification-detail.menu-silence', 'Silence notifications')}
            icon="bell-slash"
            url={makeLabelBasedSilenceLink('grafana', notification.groupLabels!)}
          />
        ) : (
          <Tooltip
            content={t(
              'alerting.notification-detail.menu-silence-no-permission',
              'You do not have permission to create silences'
            )}
          >
            <Menu.Item
              label={t('alerting.notification-detail.menu-silence', 'Silence notifications')}
              icon="bell-slash"
              disabled
            />
          </Tooltip>
        ))}
      {shouldShowDeclareIncident && (
        <DeclareIncidentMenuItem title={pickHeadingLabel(notification.groupLabels)} url="" />
      )}
      {isAssistantAvailable && openAssistant && (
        <Menu.Item
          label={t('alerting.notification-detail.menu-analyze', 'Analyze alert notification')}
          icon="ai-sparkle"
          onClick={() => {
            openAssistant({
              origin: 'alerting/notification-detail',
              mode: 'assistant',
              prompt: `Analyze the alert notification for "${pickHeadingLabel(notification.groupLabels)}" delivered to contact point "${notification.receiver}" via ${notification.integration}. The notification status is ${notification.status} and the delivery outcome was ${notification.outcome}.`,
              autoSend: true,
            });
          }}
        />
      )}
      <Menu.Divider />
      <Menu.Item
        label={t('alerting.notification-detail.menu-copy-link', 'Copy link')}
        icon="share-alt"
        onClick={() => {
          const url = window.location.href;
          navigator.clipboard?.writeText(url).then(() => {
            appEvents.emit(AppEvents.alertSuccess, ['URL copied to clipboard']);
          });
        }}
      />
    </>
  );

  return (
    <Dropdown overlay={<Menu>{menuItems}</Menu>} placement="bottom">
      <MoreButton size="md" />
    </Dropdown>
  );
}

function pickHeadingLabel(groupLabels: Record<string, string> | undefined): string {
  if (!groupLabels || Object.keys(groupLabels).length === 0) {
    return 'Notification';
  }
  if (groupLabels.alertname) {
    return groupLabels.alertname;
  }
  if (groupLabels.service_name) {
    return groupLabels.service_name;
  }
  return Object.keys(groupLabels).sort()[0];
}
