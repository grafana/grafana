import { css } from '@emotion/css';

import { AlertLabels } from '@grafana/alerting/unstable';
import { CreateNotificationsqueryalertsNotificationEntryAlert } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { GrafanaTheme2, dateTime, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { LoadingPlaceholder, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

interface AlertsSectionProps {
  alerts: CreateNotificationsqueryalertsNotificationEntryAlert[];
  groupLabels: Record<string, string>;
  isLoading: boolean;
}

export function AlertsSection({ alerts, groupLabels, isLoading }: AlertsSectionProps) {
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
    <>
      <AlertsList
        alerts={alerts.filter((a) => a.status === 'firing')}
        groupLabels={groupLabels}
        heading={t('alerting.notification-detail.firing-alerts', 'Firing Alerts')}
      />
      <AlertsList
        alerts={alerts.filter((a) => a.status !== 'firing')}
        groupLabels={groupLabels}
        heading={t('alerting.notification-detail.resolved-alerts', 'Resolved Alerts')}
      />
    </>
  );
}

interface AlertsListProps {
  alerts: CreateNotificationsqueryalertsNotificationEntryAlert[];
  groupLabels: Record<string, string>;
  heading: string;
}

function AlertsList({ alerts, groupLabels, heading }: AlertsListProps) {
  const styles = useStyles2(getStyles);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Stack direction="column" gap={1}>
      <Text variant="h6">
        {heading} ({alerts.length})
      </Text>
      {alerts.map((alert, index) => {
        const ruleUid = alert.labels?.__alert_rule_uid__;
        const alertName = alert.labels?.alertname || 'Alert';
        const folderName = alert.labels?.grafana_folder || '';
        const linkText = folderName ? `${folderName} / ${alertName}` : alertName;
        const ruleLink = ruleUid ? `/alerting/grafana/${ruleUid}/view` : undefined;

        const filteredLabels = alert.labels
          ? Object.keys(alert.labels).reduce((acc: Record<string, string>, key: string) => {
              if (key !== 'grafana_folder' && !(key in groupLabels)) {
                acc[key] = alert.labels[key];
              }
              return acc;
            }, {})
          : {};

        const summary = alert.annotations?.summary;
        const description = alert.annotations?.description;
        const otherAnnotations = alert.annotations
          ? Object.keys(alert.annotations).reduce((acc: Record<string, string>, key: string) => {
              if (key !== 'summary' && key !== 'description') {
                acc[key] = alert.annotations[key];
              }
              return acc;
            }, {})
          : {};

        return (
          <div key={index} className={styles.alertDetail}>
            <Stack direction="column" gap={1}>
              <Stack direction="row" gap={1} alignItems="center" wrap="wrap">
                {ruleLink ? (
                  <TextLink href={ruleLink} color="primary" inline={false}>
                    {linkText}
                  </TextLink>
                ) : (
                  <Text>{linkText}</Text>
                )}
                {alert.startsAt && (
                  <Tooltip content={dateTime(alert.startsAt).format('YYYY-MM-DD HH:mm:ss')}>
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
              {Object.keys(otherAnnotations).length > 0 && (
                <Stack direction="row" gap={1} alignItems="center">
                  <Text variant="bodySmall" color="secondary">
                    <strong>
                      <Trans i18nKey="alerting.notifications-scene.annotations">Annotations:</Trans>
                    </strong>
                  </Text>
                  <AlertLabels labels={otherAnnotations} size="sm" />
                </Stack>
              )}
              {summary && (
                <Text variant="bodySmall" color="secondary">
                  <strong>
                    <Trans i18nKey="alerting.notifications-scene.summary">Summary:</Trans>
                  </strong>{' '}
                  {summary}
                </Text>
              )}
              {description && (
                <Text variant="bodySmall" color="secondary">
                  <strong>
                    <Trans i18nKey="alerting.notifications-scene.description">Description:</Trans>
                  </strong>{' '}
                  {description}
                </Text>
              )}
            </Stack>
          </div>
        );
      })}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  alertDetail: css({
    padding: theme.spacing(1.5),
    backgroundColor: theme.colors.background.canvas,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});
