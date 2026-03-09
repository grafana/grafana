import { useEffect, useMemo } from 'react';

import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { Labels, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Box, LoadingPlaceholder, Stack, Text } from '@grafana/ui';

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
  loadingBarRef: React.Ref<HTMLDivElement>;
}

export function InstanceTimelineSection({
  ruleUID,
  instanceLabels,
  timeRange,
  historyRecords,
  stateHistoryFetching,
  stateHistoryError,
  loadingBarRef,
}: InstanceTimelineSectionProps) {
  const [
    createNotificationQuery,
    { data: notificationData, isLoading: notificationsLoading, isError: notificationsError },
  ] = useCreateNotificationqueryMutation();

  const labelsKey = JSON.stringify(instanceLabels);

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
    // labelsKey is used as a stable proxy for instanceLabels to avoid re-triggering on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createNotificationQuery, ruleUID, labelsKey, timeRange]);

  const notifications = useMemo(() => {
    return notificationData?.entries ?? [];
  }, [notificationData?.entries]);

  const isLoading = stateHistoryFetching || notificationsLoading;

  return (
    <Box ref={loadingBarRef}>
      <Stack direction="column" gap={1}>
        <Text variant="h5">{t('alerting.instance-details.instance-timeline', 'Instance Timeline')}</Text>

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
              'The timeline will only show state changes. Check that notification history is enabled and try again.'
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
