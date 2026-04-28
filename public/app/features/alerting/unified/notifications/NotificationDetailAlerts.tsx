import { css } from '@emotion/css';
import { useMemo } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { type CreateNotificationsqueryalertsNotificationEntryAlert } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { type GrafanaTheme2, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LoadingPlaceholder, Stack, Text, TextLink, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { AlertEnrichments } from '../components/AlertEnrichments';
import { StateTag } from '../components/StateTag';

type AlertEntry = CreateNotificationsqueryalertsNotificationEntryAlert;

interface SectionProps {
  alerts: AlertEntry[];
  groupLabels: Record<string, string>;
  isLoading: boolean;
}

function getCommonLabels(alerts: AlertEntry[], groupLabels: Record<string, string>): Record<string, string> {
  if (alerts.length === 0) {
    return {};
  }

  const firstLabels = alerts[0].labels ?? {};
  const common: Record<string, string> = {};

  for (const [key, value] of Object.entries(firstLabels)) {
    if (key in groupLabels || key === 'grafana_folder') {
      continue;
    }
    if (alerts.every((a) => a.labels?.[key] === value)) {
      common[key] = value;
    }
  }

  return common;
}

function getCommonAnnotations(alerts: AlertEntry[]): Record<string, string> {
  if (alerts.length === 0) {
    return {};
  }

  const firstAnnotations = alerts[0].annotations ?? {};
  const common: Record<string, string> = {};

  for (const [key, value] of Object.entries(firstAnnotations)) {
    if (key.startsWith('__')) {
      continue;
    }
    if (alerts.every((a) => a.annotations?.[key] === value)) {
      common[key] = value;
    }
  }

  return common;
}

export function OverviewSection({ alerts, groupLabels, isLoading }: SectionProps) {
  const styles = useStyles2(getStyles);
  const commonLabels = useMemo(() => getCommonLabels(alerts, groupLabels), [alerts, groupLabels]);
  const commonAnnotations = useMemo(() => getCommonAnnotations(alerts), [alerts]);

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.notification-detail.alerts-loading', 'Loading alerts...')} />;
  }

  if (alerts.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.notification-detail.alerts-empty">No alerts found for this notification.</Trans>
      </Text>
    );
  }

  const hasCommonLabels = Object.keys(commonLabels).length > 0;
  const hasCommonAnnotations = Object.keys(commonAnnotations).length > 0;
  const enrichedAlerts = alerts.filter((a) => a.enrichments);

  if (!hasCommonLabels && !hasCommonAnnotations && enrichedAlerts.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.notification-detail.no-common-data">
          No common labels or annotations across alerts.
        </Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      {hasCommonLabels && (
        <div className={styles.alertDetail}>
          <Stack direction="column" gap={1}>
            <Text variant="h6">
              <Trans i18nKey="alerting.notification-detail.common-labels">Labels</Trans>
            </Text>
            <AlertLabels labels={commonLabels} size="sm" />
          </Stack>
        </div>
      )}
      {hasCommonAnnotations && (
        <div className={styles.alertDetail}>
          <Stack direction="column" gap={1}>
            <Text variant="h6">
              <Trans i18nKey="alerting.notification-detail.common-annotations">Annotations</Trans>
            </Text>
            <table className={styles.annotationsTable}>
              <tbody>
                {Object.entries(commonAnnotations).map(([key, value]) => (
                  <tr key={key}>
                    <td className={styles.annotationKey}>
                      <Text color="secondary">{key}</Text>
                    </td>
                    <td className={styles.annotationValue}>
                      <AnnotationValue value={value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Stack>
        </div>
      )}
      {enrichedAlerts.length > 0 && (
        <div className={styles.alertDetail}>
          {enrichedAlerts.map((alert, index) => (
            <AlertEnrichments
              key={`${alert.labels?.__alert_rule_uid__}-${alert.startsAt}-${index}`}
              enrichments={alert.enrichments!}
            />
          ))}
        </div>
      )}
    </Stack>
  );
}

export function AlertsListSection({ alerts, groupLabels, isLoading }: SectionProps) {
  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.notification-detail.alerts-loading', 'Loading alerts...')} />;
  }

  if (alerts.length === 0) {
    return (
      <Text color="secondary">
        <Trans i18nKey="alerting.notification-detail.alerts-empty">No alerts found for this notification.</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={1}>
      {alerts.map((alert, index) => (
        <AlertCard
          key={`${alert.labels?.__alert_rule_uid__}-${alert.startsAt}-${index}`}
          alert={alert}
          groupLabels={groupLabels}
        />
      ))}
    </Stack>
  );
}

interface AlertCardProps {
  alert: AlertEntry;
  groupLabels: Record<string, string>;
}

function AlertCard({ alert, groupLabels }: AlertCardProps) {
  const styles = useStyles2(getStyles);

  const ruleUid = alert.labels?.__alert_rule_uid__;
  const alertName = alert.labels?.alertname || 'Alert';
  const folderName = alert.labels?.grafana_folder || '';
  const linkText = folderName ? `${folderName} / ${alertName}` : alertName;
  const ruleLink = ruleUid ? `/alerting/grafana/${ruleUid}/view` : undefined;

  const isFiring = alert.status === 'firing';

  const filteredLabels = alert.labels
    ? Object.keys(alert.labels).reduce((acc: Record<string, string>, key: string) => {
        if (key !== 'grafana_folder' && !(key in groupLabels)) {
          acc[key] = alert.labels[key];
        }
        return acc;
      }, {})
    : {};

  const annotations = alert.annotations
    ? Object.keys(alert.annotations).reduce((acc: Record<string, string>, key: string) => {
        if (!key.startsWith('__')) {
          acc[key] = alert.annotations[key];
        }
        return acc;
      }, {})
    : {};
  const hasAnnotations = Object.keys(annotations).length > 0;

  return (
    <div className={styles.alertDetail}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1.5} alignItems="center" wrap="wrap">
          <StateTag state={isFiring ? 'bad' : 'good'} size="sm">
            {isFiring
              ? t('alerting.notification-detail.alert-status-firing', 'Firing')
              : t('alerting.notification-detail.alert-status-resolved', 'Resolved')}
          </StateTag>
          {ruleLink ? (
            <TextLink href={ruleLink} color="primary" inline={false}>
              {linkText}
            </TextLink>
          ) : (
            <Text>{linkText}</Text>
          )}
          {alert.startsAt && (
            <Tooltip content={dateTimeFormat(alert.startsAt)}>
              <Text variant="bodySmall" color="secondary">
                {dateTimeFormatTimeAgo(alert.startsAt)}
              </Text>
            </Tooltip>
          )}
        </Stack>
        {Object.keys(filteredLabels).length > 0 && (
          <Stack direction="row" gap={1} alignItems="center">
            <Text variant="bodySmall" color="secondary">
              <strong>
                <Trans i18nKey="alerting.notifications-scene.labels">Labels:</Trans>
              </strong>
            </Text>
            <AlertLabels labels={filteredLabels} size="sm" />
          </Stack>
        )}
        {hasAnnotations && (
          <table className={styles.annotationsTable}>
            <tbody>
              {Object.entries(annotations).map(([key, value]) => (
                <tr key={key}>
                  <td className={styles.annotationKey}>
                    <Text color="secondary">{key}</Text>
                  </td>
                  <td className={styles.annotationValue}>
                    <AnnotationValue value={value} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Stack>
    </div>
  );
}

function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function AnnotationValue({ value }: { value: string }) {
  if (isUrl(value)) {
    return (
      <TextLink href={value} external inline={false}>
        {value}
      </TextLink>
    );
  }

  return <Text>{value}</Text>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  alertDetail: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  annotationsTable: css({
    borderCollapse: 'collapse',
    width: '100%',

    td: {
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
      verticalAlign: 'top',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    },

    'tr:last-child td': {
      borderBottom: 'none',
    },
  }),
  annotationKey: css({
    whiteSpace: 'nowrap',
    width: '1%',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  annotationValue: css({
    wordBreak: 'break-word',
  }),
});
