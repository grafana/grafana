import { css } from '@emotion/css';
import { fromPairs, isEmpty, sortBy, take, uniq } from 'lodash';
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AlertLabels } from '@grafana/alerting/unstable';
import { type DataFrame } from '@grafana/data/dataframe';
import { dateTime } from '@grafana/data/datetime';
import type { GrafanaTheme2 } from '@grafana/data/themes';
import type { SelectableValue, TimeRange } from '@grafana/data/types';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, Input, Label, Select, Stack, Text, Tooltip } from '@grafana/ui';
import { Icon } from '@grafana/ui/components/icons';
import { useStyles2 } from '@grafana/ui/themes';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { useSlowQuery } from '../../../hooks/useSlowQuery';
import { combineMatcherStrings } from '../../../utils/alertmanager';
import { PopupCard } from '../../HoverCard';
import { StateFilterValues } from '../central-state-history/constants';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogTimelineViewer } from './LogTimelineViewer';
import { useRuleHistoryRecords } from './useRuleHistoryRecords';

interface Props {
  ruleUID: string;
}

const STATE_HISTORY_POLLING_INTERVAL = 10 * 1000; // 10 seconds

const STATE_FILTER_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'All', value: StateFilterValues.all },
  { label: 'Alerting', value: StateFilterValues.firing },
  { label: 'Normal', value: StateFilterValues.normal },
  { label: 'Pending', value: StateFilterValues.pending },
  { label: 'NoData', value: 'NoData' },
  { label: 'Error', value: 'Error' },
  { label: 'Recovering', value: StateFilterValues.recovering },
];
const MAX_TIMELINE_SERIES = 12;

const LokiStateHistory = ({ ruleUID }: Props) => {
  const styles = useStyles2(getStyles);
  const [instancesFilter, setInstancesFilter] = useState('');
  const [stateFrom, setStateFrom] = useState<string>(StateFilterValues.all);
  const [stateTo, setStateTo] = useState<string>(StateFilterValues.all);
  const logsRef = useRef<Map<number, HTMLElement>>(new Map<number, HTMLElement>());

  const { getValues, setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } });

  const { useGetRuleHistoryQuery } = stateHistoryApi;

  // We prefer log count-based limit rather than time-based, but the API doesn't support it yet
  const queryTimeRange = useMemo(() => getDefaultTimeRange(), []);

  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery(
    {
      ruleUid: ruleUID,
      from: queryTimeRange.from.unix(),
      to: queryTimeRange.to.unix(),
      limit: 250,
      previous: stateFrom !== StateFilterValues.all ? stateFrom : undefined,
      current: stateTo !== StateFilterValues.all ? stateTo : undefined,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: STATE_HISTORY_POLLING_INTERVAL,
    }
  );

  const isSlowQuery = useSlowQuery(isLoading);

  const { dataFrames, historyRecords, commonLabels, totalRecordsCount } = useRuleHistoryRecords(
    stateHistory,
    instancesFilter
  );

  const { frameSubset, frameTimeRange } = useFrameSubset(dataFrames);

  const onLogRecordLabelClick = useCallback(
    (label: string) => {
      const matcherString = combineMatcherStrings(getValues('query'), label);
      setInstancesFilter(matcherString);
      setValue('query', matcherString);
    },
    [setInstancesFilter, setValue, getValues]
  );

  const onFilterCleared = useCallback(() => {
    setInstancesFilter('');
    setValue('query', '');
    setStateFrom(StateFilterValues.all);
    setStateTo(StateFilterValues.all);
  }, [setInstancesFilter, setValue]);

  if (isLoading) {
    return (
      <Stack direction="column" gap={1}>
        {isSlowQuery && (
          <Alert
            severity="warning"
            title={t('alerting.loki-state-history.slow-query.title', 'Query is taking longer than expected')}
          >
            {t(
              'alerting.loki-state-history.slow-query.text',
              'This query is taking longer than expected. This can happen when a regex or negation label filter matches too many alert instances. Consider using a shorter time range or a more specific filter.'
            )}
          </Alert>
        )}
        <div>
          <Trans i18nKey="alerting.loki-state-history.loading">Loading...</Trans>
        </div>
      </Stack>
    );
  }
  if (isError) {
    return (
      <Alert
        title={t(
          'alerting.loki-state-history.title-error-fetching-the-state-history',
          'Error fetching the state history'
        )}
        severity="error"
      >
        {error instanceof Error
          ? error.message
          : t('alerting.loki-state-history.error-unable-to-fetch', 'Unable to fetch alert state history')}
      </Alert>
    );
  }

  const hasMoreInstances = frameSubset.length < dataFrames.length;
  const hasActiveStateFilter = stateFrom !== StateFilterValues.all || stateTo !== StateFilterValues.all;

  let emptyStateMessage: string;
  if (totalRecordsCount > 0) {
    emptyStateMessage = `No matches were found for the given filters among the ${totalRecordsCount} instances`;
  } else if (hasActiveStateFilter) {
    emptyStateMessage = t(
      'alerting.loki-state-history.no-transitions-match-filters',
      'No state transitions match the selected filters'
    );
  } else {
    emptyStateMessage = 'No state transitions have occurred in the last 30 days';
  }

  return (
    <div className={styles.fullSize}>
      <Stack direction="row" gap={1} alignItems="flex-end">
        <div className={styles.instancesFilterForm}>
          <form onSubmit={handleSubmit((data) => setInstancesFilter(data.query))}>
            <SearchFieldInput
              {...register('query')}
              showClearFilterSuffix={!!instancesFilter}
              onClearFilterClick={onFilterCleared}
            />
            <input type="submit" hidden />
          </form>
        </div>
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
      </Stack>
      {!isEmpty(commonLabels) && (
        <div className={styles.commonLabels}>
          <Stack gap={1} alignItems="center" wrap="wrap">
            <Stack gap={0.5} alignItems="center" minWidth="fit-content">
              <Text variant="bodySmall">
                <Trans i18nKey="alerting.loki-state-history.common-labels">Common labels</Trans>
              </Text>
              <Tooltip
                content={t(
                  'alerting.loki-state-history.tooltip-common-labels',
                  'Common labels are the ones attached to all of the alert instances'
                )}
              >
                <Icon name="info-circle" size="sm" />
              </Tooltip>
            </Stack>
            <AlertLabels labels={fromPairs(commonLabels)} size="sm" />
          </Stack>
        </div>
      )}
      {isEmpty(frameSubset) ? (
        <div className={styles.emptyState}>
          {emptyStateMessage}
          {(totalRecordsCount > 0 || hasActiveStateFilter) && (
            <Button variant="secondary" type="button" onClick={onFilterCleared}>
              <Trans i18nKey="alerting.loki-state-history.clear-filters">Clear filters</Trans>
            </Button>
          )}
        </div>
      ) : (
        <>
          {hasActiveStateFilter ? (
            <div className={styles.timelineHiddenMessage}>
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.loki-state-history.timeline-hidden">
                  Timeline is hidden when state filters are active
                </Trans>
              </Text>
            </div>
          ) : (
            <div className={styles.graphWrapper}>
              <LogTimelineViewer frames={frameSubset} timeRange={frameTimeRange} />
            </div>
          )}
          {hasMoreInstances && (
            <div className={styles.moreInstancesWarning}>
              <Stack direction="row" alignItems="center" gap={1}>
                <Icon name="exclamation-triangle" size="sm" />
                <small>{`Only showing ${frameSubset.length} out of ${dataFrames.length} instances. Click on the labels to narrow down the results`}</small>
              </Stack>
            </div>
          )}
          <LogRecordViewerByTimestamp
            records={historyRecords}
            commonLabels={commonLabels}
            onRecordsRendered={(recordRefs) => (logsRef.current = recordRefs)}
            onLabelClick={onLogRecordLabelClick}
          />
        </>
      )}
    </div>
  );
};

export function useFrameSubset(frames: DataFrame[]) {
  return useMemo(() => {
    const frameSubset = take(frames, MAX_TIMELINE_SERIES);
    const frameSubsetTimestamps = sortBy(uniq(frameSubset.flatMap((frame) => frame.fields[0].values)));

    const minTs = Math.min(...frameSubsetTimestamps);
    const maxTs = Math.max(...frameSubsetTimestamps);

    const rangeStart = dateTime(minTs);
    const rangeStop = dateTime(maxTs);

    const frameTimeRange: TimeRange = {
      from: rangeStart,
      to: rangeStop,
      raw: {
        from: rangeStart,
        to: rangeStop,
      },
    };

    return { frameSubset, frameSubsetTimestamps, frameTimeRange };
  }, [frames]);
}

interface SearchFieldInputProps extends Omit<React.ComponentProps<typeof Input>, 'prefix' | 'suffix' | 'placeholder'> {
  showClearFilterSuffix: boolean;
  onClearFilterClick: () => void;
}

const SearchFieldInput = React.forwardRef<HTMLInputElement, SearchFieldInputProps>(
  ({ showClearFilterSuffix, onClearFilterClick, ...rest }: SearchFieldInputProps, ref) => {
    return (
      <Field
        noMargin
        label={
          <Label htmlFor="instancesSearchInput">
            <Stack gap={0.5}>
              <span>
                <Trans i18nKey="alerting.search-field-input.filter-instances">Filter instances</Trans>
              </span>
              <PopupCard
                content={
                  <>
                    <Trans i18nKey="alerting.search-field-input.filter-instances-tooltip">
                      Use label matcher expression or click on an instance label to filter instances, for example:
                    </Trans>
                    <div>
                      <code>{'{foo=bar}'}</code>
                    </div>
                  </>
                }
              >
                <Icon name="info-circle" size="sm" />
              </PopupCard>
            </Stack>
          </Label>
        }
      >
        <Input
          id="instancesSearchInput"
          prefix={<Icon name="search" />}
          suffix={
            showClearFilterSuffix && (
              <Button fill="text" icon="times" size="sm" onClick={onClearFilterClick}>
                <Trans i18nKey="alerting.search-field-input.clear">Clear</Trans>
              </Button>
            )
          }
          placeholder={t(
            'alerting.search-field-input.instancesSearchInput-placeholder-filter-instances',
            'Filter instances'
          )}
          ref={ref}
          {...rest}
        />
      </Field>
    );
  }
);
SearchFieldInput.displayName = 'SearchFieldInput';

function getDefaultTimeRange(): TimeRange {
  const fromDateTime = dateTime().subtract(30, 'days');
  const toDateTime = dateTime();
  return {
    from: fromDateTime,
    to: toDateTime,
    raw: { from: fromDateTime, to: toDateTime },
  };
}

export const getStyles = (theme: GrafanaTheme2) => ({
  fullSize: css({
    minWidth: '100%',
    height: '100%',

    display: 'flex',
    flexDirection: 'column',
  }),
  commonLabels: css({
    padding: theme.spacing(1, 0),
  }),
  timelineHiddenMessage: css({
    textAlign: 'center',
    padding: theme.spacing(1, 0),
  }),
  instancesFilterForm: css({
    flex: 1,
    minWidth: 0,
  }),
  graphWrapper: css({
    padding: `${theme.spacing()} 0`,
  }),
  emptyState: css({
    color: theme.colors.text.secondary,

    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    margin: 'auto auto',
  }),
  moreInstancesWarning: css({
    color: theme.colors.warning.text,
    padding: theme.spacing(),
  }),
  // we need !important here to override the list item default styles
  highlightedLogRecord: css({
    background: `${theme.colors.primary.transparent} !important`,
    outline: `1px solid ${theme.colors.primary.shade} !important`,
  }),
});

export default LokiStateHistory;
