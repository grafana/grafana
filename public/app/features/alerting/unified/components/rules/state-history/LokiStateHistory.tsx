import { css } from '@emotion/css';
import { isEmpty, sortBy, take, uniq } from 'lodash';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { dateTime, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Button, Field, Icon, Input, Label, TagList, useStyles2 } from '@grafana/ui';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { combineMatcherStrings } from '../../../utils/alertmanager';
import { HoverCard } from '../../HoverCard';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogTimelineViewer } from './LogTimelineViewer';
import { useRuleHistoryRecords } from './useRuleHistoryRecords';

interface Props {
  ruleUID: string;
}

const MAX_TIMELINE_SERIES = 20;

const LokiStateHistory = ({ ruleUID }: Props) => {
  const styles = useStyles2(getStyles);
  const [instancesFilter, setInstancesFilter] = useState('');
  const logsRef = useRef<HTMLDivElement[]>([]);

  const { getValues, setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } });

  const { useGetRuleHistoryQuery } = stateHistoryApi;
  const timeRange = useMemo(() => getDefaultTimeRange(), []);
  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery({ ruleUid: ruleUID, from: timeRange.from.unix(), to: timeRange.to.unix() });

  const { dataFrames, historyRecords, commonLabels, totalRecordsCount } = useRuleHistoryRecords(
    stateHistory,
    instancesFilter
  );

  const frameSubset = useMemo(() => take(dataFrames, MAX_TIMELINE_SERIES), [dataFrames]);

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

  const onTimelinePointerMove = useCallback(
    (seriesIdx: number, pointIdx: number) => {
      const uniqueTimestamps = sortBy(uniq(frameSubset.flatMap((frame) => frame.fields[0].values)));

      const timestamp = uniqueTimestamps[pointIdx];

      const refToScroll = logsRef.current.find((x) => parseInt(x.id, 10) === timestamp);
      refToScroll?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [frameSubset]
  );

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isError) {
    return (
      <Alert title="Error fetching the state history" severity="error">
        {error instanceof Error ? error.message : 'Unable to fetch alert state history'}
      </Alert>
    );
  }

  const hasMoreInstances = frameSubset.length < dataFrames.length;
  const emptyStateMessage =
    totalRecordsCount > 0
      ? `No matches were found for the given filters among the ${totalRecordsCount} instances`
      : 'No state transitions have occurred in the last 60 minutes';

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
        <Stack direction="row" alignItems="center">
          <strong>Common labels</strong>
          <TagList tags={commonLabels.map((label) => label.join('='))} />
        </Stack>
      )}
      {isEmpty(frameSubset) ? (
        <>
          <div className={styles.emptyState}>
            {emptyStateMessage}
            {totalRecordsCount > 0 && (
              <Button variant="secondary" type="button" onClick={onFilterCleared}>
                Clear filters
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={styles.graphWrapper}>
            <LogTimelineViewer frames={frameSubset} timeRange={timeRange} onPointerMove={onTimelinePointerMove} />
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
            logsRef={logsRef}
            onLabelClick={onLogRecordLabelClick}
          />
        </>
      )}
    </div>
  );
};

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
              <span>Filter instances</span>
              <HoverCard
                content={
                  <>
                    Use label matcher expression (like <code>{'{foo=bar}'}</code>) or click on an instance label to
                    filter instances
                  </>
                }
              >
                <Icon name="info-circle" size="sm" />
              </HoverCard>
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
                Clear
              </Button>
            )
          }
          placeholder="Filter instances"
          ref={ref}
          {...rest}
        />
      </Field>
    );
  }
);
SearchFieldInput.displayName = 'SearchFieldInput';

function getDefaultTimeRange(): TimeRange {
  const fromDateTime = dateTime().subtract(1, 'h');
  const toDateTime = dateTime();
  return {
    from: fromDateTime,
    to: toDateTime,
    raw: { from: fromDateTime, to: toDateTime },
  };
}

export const getStyles = (theme: GrafanaTheme2) => ({
  fullSize: css`
    min-width: 100%;
    height: 100%;

    display: flex;
    flex-direction: column;
  `,
  graphWrapper: css`
    padding: ${theme.spacing()} 0;
  `,
  emptyState: css`
    color: ${theme.colors.text.secondary};

    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
    align-items: center;
    margin: auto auto;
  `,
  moreInstancesWarning: css`
    color: ${theme.colors.warning.text};
    padding: ${theme.spacing()};
  `,
});

export default LokiStateHistory;
