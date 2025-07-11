import { css } from '@emotion/css';
import { fromPairs, isEmpty, sortBy, take, uniq } from 'lodash';
import * as React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { DataFrame, GrafanaTheme2, TimeRange, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Field, Icon, Input, Label, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { combineMatcherStrings } from '../../../utils/alertmanager';
import { AlertLabels } from '../../AlertLabels';
import { PopupCard } from '../../HoverCard';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogTimelineViewer } from './LogTimelineViewer';
import { useRuleHistoryRecords } from './useRuleHistoryRecords';

interface Props {
  ruleUID: string;
}

const STATE_HISTORY_POLLING_INTERVAL = 10 * 1000; // 10 seconds
const MAX_TIMELINE_SERIES = 12;

const LokiStateHistory = ({ ruleUID }: Props) => {
  const styles = useStyles2(getStyles);
  const [instancesFilter, setInstancesFilter] = useState('');
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
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: STATE_HISTORY_POLLING_INTERVAL,
    }
  );

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
  }, [setInstancesFilter, setValue]);

  if (isLoading) {
    return (
      <div>
        <Trans i18nKey="alerting.loki-state-history.loading">Loading...</Trans>
      </div>
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
  const emptyStateMessage =
    totalRecordsCount > 0
      ? `No matches were found for the given filters among the ${totalRecordsCount} instances`
      : 'No state transitions have occurred in the last 30 days';

  return (
    <div className={styles.fullSize}>
      <form onSubmit={handleSubmit((data) => setInstancesFilter(data.query))}>
        <SearchFieldInput
          {...register('query')}
          showClearFilterSuffix={!!instancesFilter}
          onClearFilterClick={onFilterCleared}
        />
        <input type="submit" hidden />
      </form>
      {!isEmpty(commonLabels) && (
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
      )}
      {isEmpty(frameSubset) ? (
        <div className={styles.emptyState}>
          {emptyStateMessage}
          {totalRecordsCount > 0 && (
            <Button variant="secondary" type="button" onClick={onFilterCleared}>
              <Trans i18nKey="alerting.loki-state-history.clear-filters">Clear filters</Trans>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.graphWrapper}>
            <LogTimelineViewer frames={frameSubset} timeRange={frameTimeRange} />
          </div>
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
