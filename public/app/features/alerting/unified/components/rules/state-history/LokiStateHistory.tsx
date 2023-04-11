import { css } from '@emotion/css';
import { groupBy, isEmpty, last, sortBy, take, uniq } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { BehaviorSubject } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  dateTime,
  Field,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  SortedVector,
  TimeRange,
} from '@grafana/data';
import { fieldIndexComparer } from '@grafana/data/src/field/fieldComparers';
import { Stack } from '@grafana/experimental';
import { LegendDisplayMode, MappingType, ThresholdsMode, VisibilityMode } from '@grafana/schema';
import { Alert, FilterInput, TagList, useStyles2, useTheme2 } from '@grafana/ui';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import { TimelineMode } from 'app/core/components/TimelineChart/utils';

import { stateHistoryApi } from '../../../api/stateHistoryApi';

import { LogRecordViewerByTimestamp } from './LogRecordViewer';
import { extractCommonLabels, LogRecord, omitLabels } from './common';

interface Props {
  ruleUID: string;
}

const LokiStateHistory = ({ ruleUID }: Props) => {
  const { useGetRuleHistoryQuery } = stateHistoryApi;
  const styles = useStyles2(getStyles);
  const [instancesFilter, setInstancesFilter] = useState('');

  const frameSubsetRef = useRef<DataFrame[]>([]);

  const logsRef = useRef<HTMLDivElement[]>([]);
  const pointerSubject = useRef(
    new BehaviorSubject<{ seriesIdx: number; pointIdx: number }>({ seriesIdx: 0, pointIdx: 0 })
  );

  const timeRange = useMemo(() => getDefaultTimeRange(), []);
  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery({ ruleUid: ruleUID, from: timeRange.from.unix(), to: timeRange.to.unix() });

  const { dataFrames, historyRecords, commonLabels } = useInstanceHistoryRecords(stateHistory);

  const onLogRecordLabelClick = (label: string) => {
    setInstancesFilter(label);
  };

  useEffect(() => {
    const subject = pointerSubject.current;
    subject.subscribe((x) => {
      const uniqueTimestamps = sortBy(
        uniq(frameSubsetRef.current.flatMap((frame) => frame.fields[0].values.toArray()))
      );

      const timestamp = uniqueTimestamps[x.pointIdx];

      const refToScroll = logsRef.current.find((x) => parseInt(x.id, 10) === timestamp);
      refToScroll?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => {
      subject.unsubscribe();
    };
  }, []);

  const frameSubset = useMemo(() => take(dataFrames, 20), [dataFrames]);

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

  frameSubsetRef.current = frameSubset;

  return (
    <div className={styles.fullSize}>
      {!isEmpty(commonLabels) && (
        <Stack direction="row" alignItems="center">
          <strong>Common labels</strong>
          <TagList tags={commonLabels.map((label) => label.join('='))} />
        </Stack>
      )}
      <div className={styles.graphWrapper}>
        {!isEmpty(frameSubset) && (
          <LogTimelineViewer frames={frameSubset} timeRange={timeRange} pointerSubject={pointerSubject.current} />
        )}
      </div>
      <FilterInput label="Filter instances" value={instancesFilter} onChange={setInstancesFilter} />
      <LogRecordViewerByTimestamp
        records={historyRecords}
        commonLabels={commonLabels}
        logsRef={logsRef}
        onLabelClick={onLogRecordLabelClick}
      />
    </div>
  );
};

function useInstanceHistoryRecords(stateHistory?: DataFrameJSON) {
  const theme = useTheme2();

  return useMemo(() => {
    // merge timestamp with "line"
    // @ts-ignore
    const timestamps: number[] = stateHistory?.data?.values[0] ?? [];
    const lines = stateHistory?.data?.values[1] ?? [];

    const linesWithTimestamp = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
      // @ts-ignore
      const line: Line = lines[index];
      acc.push({ timestamp, line });

      return acc;
    }, []);

    // group all records by alert instance (unique set of labels)
    const groupedLines = groupBy(linesWithTimestamp, (record: LogRecord) => {
      return JSON.stringify(record.line.labels);
    });

    // find common labels so we can extract those from the instances
    const commonLabels = extractCommonLabels(groupedLines);

    const dataFrames: DataFrame[] = Object.entries(groupedLines).map<DataFrame>(([key, records]) => {
      return logRecordsToDataFrame(key, records, commonLabels, theme);
    });

    return {
      historyRecords: linesWithTimestamp,
      dataFrames,
      commonLabels,
    };
  }, [stateHistory, theme]);
}

interface LogTimelineViewerProps {
  frames: DataFrame[];
  timeRange: TimeRange;
  pointerSubject: BehaviorSubject<{ seriesIdx: number; pointIdx: number }>;
}

const LogTimelineViewer = React.memo(({ frames, timeRange, pointerSubject }: LogTimelineViewerProps) => {
  const theme = useTheme2();

  return (
    <AutoSizer disableHeight>
      {({ width }) => (
        <TimelineChart
          frames={frames}
          timeRange={timeRange}
          timeZone={'browser'}
          mode={TimelineMode.Changes}
          height={20 * frames.length + 40}
          width={width}
          showValue={VisibilityMode.Never}
          theme={theme}
          rowHeight={0.8}
          legend={{
            calcs: [],
            displayMode: LegendDisplayMode.List,
            placement: 'bottom',
            showLegend: true,
          }}
          legendItems={[
            { label: 'Normal', color: theme.colors.success.main, yAxis: 1 },
            { label: 'Pending', color: theme.colors.warning.main, yAxis: 1 },
            { label: 'Alerting', color: theme.colors.error.main, yAxis: 1 },
            { label: 'NoData', color: theme.colors.info.main, yAxis: 1 },
          ]}
        >
          {(builder) => {
            builder.setSync();
            const interpolator = builder.getTooltipInterpolator();

            // I found this in TooltipPlugin.tsx
            if (interpolator) {
              builder.addHook('setCursor', (u) => {
                interpolator(
                  (seriesIdx) => {
                    if (seriesIdx) {
                      const currentPointer = pointerSubject.getValue();
                      pointerSubject.next({ ...currentPointer, seriesIdx });
                    }
                  },
                  (pointIdx) => {
                    if (pointIdx) {
                      const currentPointer = pointerSubject.getValue();
                      pointerSubject.next({ ...currentPointer, pointIdx });
                    }
                  },
                  () => {},
                  u
                );
              });
            }
          }}
        </TimelineChart>
      )}
    </AutoSizer>
  );
});
LogTimelineViewer.displayName = 'LogTimelineViewer';

function logRecordsToDataFrame(
  instanceLabels: string,
  records: LogRecord[],
  commonLabels: Array<[string, string]>,
  theme: GrafanaTheme2
): DataFrame {
  const parsedInstanceLabels = Object.entries<string>(JSON.parse(instanceLabels));

  const timeIndex = records.map((_, index) => index);
  const timeField: Field = {
    name: 'time',
    type: FieldType.time,
    values: new ArrayVector([...records.map((record) => record.timestamp), Date.now()]),
    config: { displayName: 'Time', custom: { fillOpacity: 100 } },
  };

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
    length: records.length,
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
    overflow: hidden;

    display: flex;
    flex-direction: column;
  `,
  graphWrapper: css`
    padding: ${theme.spacing()} 0;
  `,
});

export default LokiStateHistory;
