import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'react-use';
import { useForm } from 'react-hook-form';

import {
  CreateNotificationqueryNotificationOutcome,
  CreateNotificationqueryNotificationStatus,
  useCreateNotificationqueryMutation,
} from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { SelectableValue, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, LoadingPlaceholder, RadioButtonGroup, Select, Stack, useStyles2 } from '@grafana/ui';
import { RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { StateFilterValues } from '../../../components/rules/central-state-history/constants';
import {
  SearchFieldInput,
  getStyles as getLokiStyles,
} from '../../../components/rules/state-history/LokiStateHistory';
import { useRuleHistoryRecords } from '../../../components/rules/state-history/useRuleHistoryRecords';
import { matcherToOperator } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { InstanceTimeline, TimelineFilter } from '../../../triage/instance-details/InstanceTimeline';

const { useGetRuleHistoryQuery } = stateHistoryApi;

const DEBOUNCE_MS = 300;

const STATE_FILTER_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'All', value: StateFilterValues.all },
  { label: 'Alerting', value: StateFilterValues.firing },
  { label: 'Normal', value: StateFilterValues.normal },
  { label: 'Pending', value: StateFilterValues.pending },
  { label: 'NoData', value: 'NoData' },
  { label: 'Error', value: 'Error' },
  { label: 'Recovering', value: StateFilterValues.recovering },
];

type StatusFilter = CreateNotificationqueryNotificationStatus;
type OutcomeFilter = CreateNotificationqueryNotificationOutcome;

interface TimelineProps {
  rule: RulerGrafanaRuleDTO;
}

export function Timeline({ rule }: TimelineProps) {
  const styles = useStyles2(getLokiStyles);
  const ruleUID = rule.grafana_alert.uid;

  // Shared label filter (used for both state history and notifications)
  const [labelFilter, setLabelFilter] = useState('');
  const [debouncedLabelFilter, setDebouncedLabelFilter] = useState('');

  // State history filters
  const [stateFrom, setStateFrom] = useState<string>(StateFilterValues.all);
  const [stateTo, setStateTo] = useState<string>(StateFilterValues.all);

  // Timeline view filter
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('all');
  const timelineFilterOptions = [
    { label: t('alerting.instance-details.timeline-filter-all', 'All'), value: 'all' as const },
    { label: t('alerting.instance-details.timeline-filter-states', 'State changes'), value: 'states' as const },
    { label: t('alerting.instance-details.timeline-filter-notifications', 'Notifications'), value: 'notifications' as const },
  ];

  // Notification filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter | 'all'>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter | 'all'>('all');

  useDebounce(() => setDebouncedLabelFilter(labelFilter), DEBOUNCE_MS, [labelFilter]);

  const { getValues, setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } });

  const queryTimeRange = useMemo(() => {
    const from = dateTime().subtract(30, 'days');
    const to = dateTime();
    return { from, to };
  }, []);

  const {
    currentData: stateHistory,
    isFetching: stateHistoryFetching,
    isError: stateHistoryError,
  } = useGetRuleHistoryQuery({
    ruleUid: ruleUID,
    from: queryTimeRange.from.unix(),
    to: queryTimeRange.to.unix(),
    limit: 250,
    previous: stateFrom !== StateFilterValues.all ? stateFrom : undefined,
    current: stateTo !== StateFilterValues.all ? stateTo : undefined,
  });

  const { historyRecords } = useRuleHistoryRecords(stateHistory, labelFilter);

  const [
    createNotificationQuery,
    { data: notificationData, isLoading: notificationsLoading, isError: notificationsError },
  ] = useCreateNotificationqueryMutation();

  useEffect(() => {
    const matchers = parsePromQLStyleMatcherLooseSafe(debouncedLabelFilter);
    const groupLabels = matchers.map((matcher) => ({
      type: matcherToOperator(matcher),
      label: matcher.name,
      value: matcher.value,
    }));

    createNotificationQuery({
      createNotificationqueryRequestBody: {
        ruleUID,
        from: queryTimeRange.from.toISOString(),
        to: queryTimeRange.to.toISOString(),
        status: statusFilter !== 'all' ? statusFilter : undefined,
        outcome: outcomeFilter !== 'all' ? outcomeFilter : undefined,
        ...(groupLabels.length > 0 && { groupLabels }),
      },
    });
  }, [createNotificationQuery, ruleUID, queryTimeRange, statusFilter, outcomeFilter, debouncedLabelFilter]);

  const notifications = useMemo(() => notificationData?.entries ?? [], [notificationData?.entries]);

  const onRow1FilterCleared = useCallback(() => {
    setLabelFilter('');
    setValue('query', '');
  }, [setValue]);

  const onRow2FilterCleared = useCallback(() => {
    setStateFrom(StateFilterValues.all);
    setStateTo(StateFilterValues.all);
    setStatusFilter('all');
    setOutcomeFilter('all');
  }, []);

  const hasActiveRow1Filters = !!labelFilter;
  const hasActiveRow2Filters =
    stateFrom !== StateFilterValues.all ||
    stateTo !== StateFilterValues.all ||
    statusFilter !== 'all' ||
    outcomeFilter !== 'all';

  const isLoading = stateHistoryFetching || notificationsLoading;

  return (
    <Stack direction="column" gap={2}>
      {/* Row 1: shared label filter + timeline view selector */}
      <Stack direction="row" gap={1} alignItems="flex-end">
        <div className={styles.instancesFilterForm}>
          <form onSubmit={handleSubmit((data) => setLabelFilter(data.query))}>
            <SearchFieldInput
              {...register('query')}
              showClearFilterSuffix={!!labelFilter}
              onClearFilterClick={onRow1FilterCleared}
            />
            <input type="submit" hidden />
          </form>
        </div>
        <RadioButtonGroup options={timelineFilterOptions} value={timelineFilter} onChange={setTimelineFilter} />
        {hasActiveRow1Filters && (
          <Button variant="secondary" type="button" onClick={onRow1FilterCleared}>
            <Trans i18nKey="alerting.loki-state-history.clear-filters">Clear filters</Trans>
          </Button>
        )}
      </Stack>

      {/* Row 2: state history + notification filters */}
      <Stack direction="row" gap={1} alignItems="flex-end">
        <Field noMargin label={t('alerting.loki-state-history.start-state', 'Start state')}>
          <Select
            options={STATE_FILTER_OPTIONS}
            value={stateFrom}
            onChange={(v) => setStateFrom(v.value ?? StateFilterValues.all)}
            width={18}
          />
        </Field>
        <Field noMargin label={t('alerting.loki-state-history.end-state', 'End state')}>
          <Select
            options={STATE_FILTER_OPTIONS}
            value={stateTo}
            onChange={(v) => setStateTo(v.value ?? StateFilterValues.all)}
            width={18}
          />
        </Field>
        <Field noMargin label={t('alerting.notification-history.filter.status', 'Status')}>
          <Select
            options={[
              { label: t('alerting.notification-history.status.all', 'All'), value: 'all' as const },
              { label: t('alerting.notification-history.status.firing', 'Firing'), value: 'firing' as const },
              { label: t('alerting.notification-history.status.resolved', 'Resolved'), value: 'resolved' as const },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v.value ?? 'all')}
            width={18}
          />
        </Field>
        <Field noMargin label={t('alerting.notification-history.filter.outcome', 'Outcome')}>
          <Select
            options={[
              { label: t('alerting.notification-history.status.all', 'All'), value: 'all' as const },
              { label: t('alerting.notification-history.outcome.success', 'Success'), value: 'success' as const },
              { label: t('alerting.notification-history.outcome.failed', 'Failed'), value: 'error' as const },
            ]}
            value={outcomeFilter}
            onChange={(v) => setOutcomeFilter(v.value ?? 'all')}
            width={18}
          />
        </Field>
        {hasActiveRow2Filters && (
          <Button variant="secondary" type="button" onClick={onRow2FilterCleared}>
            <Trans i18nKey="alerting.loki-state-history.clear-filters">Clear filters</Trans>
          </Button>
        )}
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
        <InstanceTimeline
          records={historyRecords}
          notifications={notifications}
          filter={timelineFilter}
          onFilterChange={setTimelineFilter}
        />
      )}
    </Stack>
  );
}
