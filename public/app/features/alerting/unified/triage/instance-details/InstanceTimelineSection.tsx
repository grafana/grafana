import { useEffect, useMemo } from 'react';

import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { Labels, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, LoadingBar, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

import { LogRecord } from '../../components/rules/state-history/common';

import { InstanceTimeline } from './InstanceTimeline';
import { labelsToMatchers } from './timelineUtils';

interface InstanceTimelineSectionProps {
  ruleUID: string;
  instanceLabels: Labels;
  timeRange: TimeRange;
  historyRecords: LogRecord[];
  stateHistoryFetching: boolean;
  stateHistoryError: boolean;
  loadingBarWidth: number;
  loadingBarRef: React.Ref<HTMLDivElement>;
}

export function InstanceTimelineSection({
  ruleUID,
  instanceLabels,
  timeRange,
  historyRecords,
  stateHistoryFetching,
  stateHistoryError,
  loadingBarWidth,
  loadingBarRef,
}: InstanceTimelineSectionProps) {
  const [
    createNotificationQuery,
    { data: notificationData, isLoading: notificationsLoading, isError: notificationsError },
  ] = useCreateNotificationqueryMutation();

  useEffect(() => {
    if (!timeRange?.from || !timeRange?.to) {
      return;
    }

    const labels = labelsToMatchers(instanceLabels);

    createNotificationQuery({
      createNotificationqueryRequestBody: {
        ruleUID,
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        ...(labels.length > 0 && { labels }),
      },
    });
  }, [createNotificationQuery, ruleUID, instanceLabels, timeRange]);

  const notifications = useMemo(() => {
    return notificationData?.entries ?? [];
  }, [notificationData?.entries]);

  const isLoading = stateHistoryFetching || notificationsLoading;

  return (
    <Box ref={loadingBarRef}>
      <Stack direction="column" gap={1}>
        <Text variant="h5">{t('alerting.instance-details.instance-timeline', 'Instance Timeline')}</Text>

        {isLoading && <LoadingBar width={loadingBarWidth} />}
        {isLoading && (
          <LoadingPlaceholder text={t('alerting.instance-details.timeline-loading', 'Loading timeline...')} />
        )}

        {stateHistoryError && (
          <Alert severity="error" title={t('alerting.instance-details.history-error', 'Failed to load state history')}>
            {t(
              'alerting.instance-details.history-error-desc',
              'Unable to fetch state transition history for this instance.'
            )}
          </Alert>
        )}

        {notificationsError && (
          <Alert
            severity="warning"
            title={t('alerting.instance-details.notifications-error', 'Could not load notification history')}
          >
            {t(
              'alerting.instance-details.notifications-error-desc',
              'Notification history may not be enabled. Enable the alertingNotificationHistory feature toggle.'
            )}
          </Alert>
        )}

        {!isLoading && !stateHistoryError && (
          <InstanceTimeline records={historyRecords} notifications={notifications} />
        )}
      </Stack>
    </Box>
  );
}
