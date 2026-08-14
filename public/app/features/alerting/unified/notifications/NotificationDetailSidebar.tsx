import { css } from '@emotion/css';
import { useState } from 'react';

import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Collapse, Icon, type IconName, Stack, Text, useStyles2 } from '@grafana/ui';
import { receiverTypeNames } from 'app/plugins/datasource/alertmanager/consts';

import { DetailText } from '../components/common/DetailText';
import { INTEGRATION_ICONS } from '../types/contact-points';

import { formatDuration } from './NotificationDetailHeader';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface NotificationDetailSidebarProps {
  notification: NotificationEntry;
}

export function NotificationDetailSidebar({ notification }: NotificationDetailSidebarProps) {
  const styles = useStyles2(getStyles);
  const isError = notification.outcome === 'error';
  const integrationIcon: IconName = INTEGRATION_ICONS[notification.integration] || 'bell';
  const [isMoreDetailsOpen, setIsMoreDetailsOpen] = useState(false);

  return (
    <div className={styles.container}>
      <DetailText
        id="delivery-outcome"
        label={t('alerting.notification-detail.sidebar-delivery-outcome', 'Delivery outcome')}
        value={
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon
              name={isError ? 'exclamation-circle' : 'check-circle'}
              className={isError ? styles.errorIcon : styles.successIcon}
              size="sm"
            />
            <Text>
              {isError
                ? t('alerting.notification-detail.sidebar-delivery-failed', 'Delivery failed')
                : t('alerting.notification-detail.sidebar-delivery-success', 'Delivered successfully')}
            </Text>
          </Stack>
        }
      />

      <DetailText
        id="timestamp"
        label={t('alerting.notification-detail.sidebar-timestamp', 'Timestamp')}
        value={dateTimeFormat(notification.timestamp)}
      />

      <DetailText
        id="contact-point"
        label={t('alerting.notification-detail.sidebar-contact-point', 'Contact point')}
        value={notification.receiver}
      />

      <DetailText
        id="integration"
        label={t('alerting.notification-detail.sidebar-integration', 'Integration')}
        value={
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon name={integrationIcon} size="sm" />
            <Text>
              {receiverTypeNames[notification.integration] ?? notification.integration} #
              {notification.integrationIndex + 1}
            </Text>
          </Stack>
        }
      />

      <DetailText
        id="duration"
        label={t('alerting.notification-detail.sidebar-duration', 'Duration')}
        value={formatDuration(notification.duration)}
      />

      {notification.retry && (
        <DetailText
          id="retry"
          label={t('alerting.notification-detail.sidebar-retry', 'Retry')}
          value={t('alerting.notification-detail.sidebar-retry-value', 'This was a retry of a previous attempt')}
        />
      )}

      <Collapse
        label={t('alerting.notification-detail.more-details-heading', 'More details')}
        isOpen={isMoreDetailsOpen}
        onToggle={setIsMoreDetailsOpen}
        className={styles.collapse}
      >
        <div className={styles.moreDetails}>
          <DetailText
            id="uuid"
            label={t('alerting.notification-detail.field-uuid', 'UUID')}
            value={notification.uuid}
            monospace
            showCopyButton
            copyValue={notification.uuid}
          />

          <DetailText
            id="pipeline-time"
            label={t('alerting.notification-detail.field-pipeline-time', 'Pipeline time')}
            value={dateTimeFormat(notification.pipelineTime)}
          />

          <DetailText
            id="integration-index"
            label={t('alerting.notification-detail.field-integration-index', 'Integration index')}
            value={String(notification.integrationIndex)}
          />

          <DetailText
            id="retry-detail"
            label={t('alerting.notification-detail.field-retry', 'Retry')}
            value={
              notification.retry
                ? t('alerting.notification-detail.yes', 'Yes')
                : t('alerting.notification-detail.no', 'No')
            }
          />

          <DetailText
            id="group-key"
            label={t('alerting.notification-detail.field-group-key', 'Group key')}
            value={<code className={styles.groupKey}>{notification.groupKey}</code>}
          />
        </div>
      </Collapse>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gap: theme.spacing(3),
    gridTemplateColumns: '1fr',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
  }),
  successIcon: css({
    color: theme.colors.success.text,
  }),
  errorIcon: css({
    color: theme.colors.error.text,
  }),
  collapse: css({
    marginTop: theme.spacing(-1),
  }),
  moreDetails: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  groupKey: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    backgroundColor: theme.colors.background.canvas,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    wordBreak: 'break-all',
  }),
});
