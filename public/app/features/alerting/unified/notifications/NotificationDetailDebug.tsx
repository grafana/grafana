import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type CreateNotificationqueryNotificationEntry } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Collapse, Text } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

type NotificationEntry = CreateNotificationqueryNotificationEntry;

interface DebugDetailsProps {
  notification: NotificationEntry;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

export function DebugDetails({ notification, isOpen, onToggle }: DebugDetailsProps) {
  const styles = useStyles2(getStyles);

  return (
    <Collapse
      label={t('alerting.notification-detail.debug-details-heading', 'Debug details')}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.detailsGrid}>
        <DetailRow label={t('alerting.notification-detail.field-uuid', 'UUID')} value={notification.uuid} />
        <DetailRow
          label={t('alerting.notification-detail.field-timestamp', 'Timestamp')}
          value={dateTimeFormat(notification.timestamp)}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-pipeline-time', 'Pipeline time')}
          value={dateTimeFormat(notification.pipelineTime)}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-integration-index', 'Integration index')}
          value={String(notification.integrationIndex)}
        />
        <DetailRow
          label={t('alerting.notification-detail.field-retry', 'Retry')}
          value={
            notification.retry
              ? t('alerting.notification-detail.yes', 'Yes')
              : t('alerting.notification-detail.no', 'No')
          }
        />
        <DetailRow
          label={t('alerting.notification-detail.field-group-key', 'Group key')}
          value={<code className={styles.groupKey}>{notification.groupKey}</code>}
        />
      </div>
    </Collapse>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.detailLabel}>
        <Text color="secondary" variant="bodySmall">
          {label}
        </Text>
      </div>
      <div className={styles.detailValue}>{typeof value === 'string' ? <Text>{value}</Text> : value}</div>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  detailsGrid: css({
    display: 'grid',
    gridTemplateColumns: '180px 1fr',
    gap: `${theme.spacing(1)} ${theme.spacing(2)}`,
    alignItems: 'start',
  }),
  detailLabel: css({
    paddingTop: '2px',
  }),
  detailValue: css({
    wordBreak: 'break-all',
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
