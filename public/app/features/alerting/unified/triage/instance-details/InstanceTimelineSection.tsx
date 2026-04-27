import { useEffect, useMemo, useState } from 'react';

import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import type { Labels, TimeRange } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { Alert, Box, LoadingPlaceholder, RadioButtonGroup, Stack, Text } from '@grafana/ui';

import { type LogRecord } from '../../components/rules/state-history/common';

import { InstanceTimeline, type TimelineFilter } from './InstanceTimeline';
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

  const [filter, setFilter] = useState<TimelineFilter>('all');
  const filterOptions = [
    { label: t('alerting.instance-details.timeline-filter-all', 'All'), value: 'all' as const },
    { label: t('alerting.instance-details.timeline-filter-states', 'State changes'), value: 'states' as const },
    {
      label: t('alerting.instance-details.timeline-filter-notifications', 'Notifications'),
      value: 'notifications' as const,
    },
  ];

  return (
    <Box ref={loadingBarRef}>
      <Stack direction="column" gap={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Text variant="h5">{t('alerting.instance-details.instance-history-heading', 'History')}</Text>
          <RadioButtonGroup options={filterOptions} value={filter} onChange={setFilter} size="sm" />
        </Stack>

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
          <InstanceTimeline records={historyRecords} notifications={notifications} filter={filter} />
        )}
      </Stack>
    </Box>
  );
}
