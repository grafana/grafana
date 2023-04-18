import { css } from '@emotion/css';
import { groupBy, isEmpty, last, sortBy, take, uniq } from 'lodash';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  dateTime,
  Field as DataFrameField,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  SortedVector,
  TimeRange,
} from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/src/field/fieldComparers';
import { Stack } from '@grafana/experimental';
import { MappingType, ThresholdsMode } from '@grafana/schema';
import { Alert, Button, Field, Icon, Input, Label, TagList, useStyles2, useTheme2 } from '@grafana/ui';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { combineMatcherStrings, labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';
import { HoverCard } from '../../HoverCard';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { LogTimelineViewer } from './LogTimelineViewer';
import { extractCommonLabels, Line, LogRecord, omitLabels } from './common';

interface Props {
  ruleUID: string;
}

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

  const { dataFrames, historyRecords, commonLabels, totalRecordsCount } = useInstanceHistoryRecords(
    stateHistory,
    instancesFilter
  );

  const frameSubset = useMemo(() => take(dataFrames, 20), [dataFrames]);

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
      const uniqueTimestamps = sortBy(uniq(frameSubset.flatMap((frame) => frame.fields[0].values.toArray())));

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
            {...register('query')}
            id="instancesSearchInput"
            prefix={<Icon name="search" />}
            suffix={
              <Button fill="text" icon="times" size="sm" onClick={onFilterCleared}>
                Clear
              </Button>
            }
            placeholder="Filter instances"
          />
        </Field>
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

function useInstanceHistoryRecords(stateHistory?: DataFrameJSON, filter?: string) {
  const theme = useTheme2();

  return useMemo(() => {
    // merge timestamp with "line"
    const tsValues = stateHistory?.data?.values[0] ?? [];
    const timestamps: number[] = isNumbers(tsValues) ? tsValues : [];
    const lines = stateHistory?.data?.values[1] ?? [];

    const linesWithTimestamp = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
      const line = lines[index];
      // values property can be undefined for some instance states (e.g. NoData)
      if (isLine(line)) {
        acc.push({ timestamp, line });
      }

      return acc;
    }, []);

    // group all records by alert instance (unique set of labels)
    const groupedLines = groupBy(linesWithTimestamp, (record: LogRecord) => {
      return JSON.stringify(record.line.labels);
    });

    // CommonLabels should not be affected by the filter
    // find common labels so we can extract those from the instances
    const groupLabels = Object.keys(groupedLines);
    const groupLabelsArray: Array<Array<[string, string]>> = groupLabels.map((label) => {
      return Object.entries(JSON.parse(label));
    });

    const commonLabels = extractCommonLabels(groupLabelsArray);

    const filterMatchers = filter ? parseMatchers(filter) : [];
    const filteredGroupedLines = Object.entries(groupedLines).filter(([key]) => {
      const labels = JSON.parse(key);
      return labelsMatchMatchers(labels, filterMatchers);
    });

    const dataFrames: DataFrame[] = filteredGroupedLines.map<DataFrame>(([key, records]) => {
      return logRecordsToDataFrame(key, records, commonLabels, theme);
    });

    return {
      historyRecords: linesWithTimestamp.filter(
        ({ line }) => line.labels && labelsMatchMatchers(line.labels, filterMatchers)
      ),
      dataFrames,
      commonLabels,
      totalRecordsCount: linesWithTimestamp.length,
    };
  }, [stateHistory, filter, theme]);
}

function isNumbers(value: unknown[]): value is number[] {
  return value.every((v) => typeof v === 'number');
}

function isLine(value: unknown): value is Line {
  return typeof value === 'object' && value !== null && 'current' in value && 'previous' in value;
}

// Each alert instance is represented by a data frame
// Each frame consists of two fields: timestamp and state change
export function logRecordsToDataFrame(
  instanceLabels: string,
  records: LogRecord[],
  commonLabels: Array<[string, string]>,
  theme: GrafanaTheme2
): DataFrame {
  const parsedInstanceLabels = Object.entries<string>(JSON.parse(instanceLabels));

  // There is an artificial element at the end meaning Date.now()
  // It exist to draw the state change from when it happened to the current time
  const timeField: DataFrameField = {
    name: 'time',
    type: FieldType.time,
    values: new ArrayVector([...records.map((record) => record.timestamp), Date.now()]),
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

  const timeIndex = timeField.values.map((_, index) => index);
  timeIndex.sort(fieldIndexComparer(timeField));

  const stateValues = new ArrayVector([...records.map((record) => record.line.current), last(records)?.line.current]);

  const frame: DataFrame = {
    fields: [
      {
        ...timeField,
        values: new SortedVector(timeField.values, timeIndex),
      },
      {
        name: 'state',
        type: FieldType.string,
        values: new SortedVector(stateValues, timeIndex),
        config: {
          displayName: omitLabels(parsedInstanceLabels, commonLabels)
            .map(([key, label]) => `${key}=${label}`)
            .join(', '),
          color: { mode: 'thresholds' },
          custom: { fillOpacity: 100 },
          mappings: [
            {
              type: MappingType.ValueToText,
              options: {
                Alerting: {
                  color: theme.colors.error.main,
                },
                Pending: {
                  color: theme.colors.warning.main,
                },
                Normal: {
                  color: theme.colors.success.main,
                },
                NoData: {
                  color: theme.colors.info.main,
                },
              },
            },
          ],
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [],
          },
        },
      },
    ],
    length: timeField.values.length,
    name: instanceLabels,
  };

  frame.fields.forEach((field) => {
    field.display = getDisplayProcessor({ field, theme });
  });

  return frame;
}

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
