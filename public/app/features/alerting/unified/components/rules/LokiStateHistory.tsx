import { css } from '@emotion/css';
import { formatDistanceToNowStrict, getUnixTime, subMinutes } from 'date-fns';
import { groupBy, isEmpty, isEqual, take, uniqBy, uniqueId } from 'lodash';
import React, { useEffect, useRef } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { BehaviorSubject } from 'rxjs';

import {
  ArrayVector,
  DataFrame,
  dateTime,
  dateTimeFormat,
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
import { Alert, Icon, TagList, useStyles2, useTheme2 } from '@grafana/ui';
import { TimelineChart } from 'app/core/components/TimelineChart/TimelineChart';
import { TimelineMode } from 'app/core/components/TimelineChart/utils';
import { GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../api/stateHistoryApi';
import { Label } from '../Label';

import { AlertStateTag } from './AlertStateTag';

interface Line {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  values: Record<string, number>;
  labels: Record<string, string>;
}

interface LogRecord {
  timestamp: number;
  line: Line;
}

interface Props {
  ruleUID: string;
}

const LokiStateHistory = ({ ruleUID }: Props) => {
  const { useGetRuleHistoryQuery } = stateHistoryApi;
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const frameSubsetRef = useRef<DataFrame[]>([]);
  const logsRef = useRef<HTMLDivElement[]>([]);
  const pointerSubject = useRef(
    new BehaviorSubject<{ seriesIdx: number; pointIdx: number }>({ seriesIdx: 0, pointIdx: 0 })
  );

  const from = getUnixTime(subMinutes(new Date(), 60));
  const { currentData: stateHistory, isLoading, isError, error } = useGetRuleHistoryQuery({ ruleUid: ruleUID, from });

  useEffect(() => {
    const subject = pointerSubject.current;
    subject.subscribe((x) => {
      const timestamp = frameSubsetRef.current[x.seriesIdx - 1]?.fields[0].values.get(x.pointIdx - 1);
      console.log(`Series: ${x.seriesIdx} | Point: ${x.pointIdx} |`, 'Timestamp: ', dateTimeFormat(timestamp));

      const refToScroll = logsRef.current.find((x) => parseInt(x.id, 10) === timestamp);
      refToScroll?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => {
      subject.unsubscribe();
    };
  }, []);

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

  const fromDateTime = dateTime(linesWithTimestamp.at(-1)?.timestamp);
  const toDateTime = dateTime(linesWithTimestamp.at(-0)?.timestamp);
  const timeRange: TimeRange = {
    from: fromDateTime,
    to: toDateTime,
    raw: { from: fromDateTime, to: toDateTime },
  };

  const dataFrames: DataFrame[] = Object.entries(groupedLines).map<DataFrame>(([key, records]) => {
    const timeIndex = records.map((_, index) => index);

    const timeField: Field = {
      name: 'time',
      type: FieldType.time,
      values: new ArrayVector(records.map((record) => record.timestamp)),
      config: { displayName: 'Time', custom: { fillOpacity: 100 } },
    };

    timeIndex.sort(fieldIndexComparer(timeField));

    const frame: DataFrame = {
      fields: [
        {
          ...timeField,
          values: new SortedVector(timeField.values, timeIndex),
        },
        {
          name: 'state',
          type: FieldType.string,
          values: new ArrayVector(records.map((record) => record.line.current)),
          config: {
            displayName: omitLabels(Object.entries(JSON.parse(key)), commonLabels)
              .map(([key, label]) => `${key}=${label}`)
              .join(', '),
            color: { mode: 'thresholds' },
            custom: { fillOpacity: 100 },
            mappings: [
              {
                type: MappingType.ValueToText,
                options: {
                  Alerting: {
                    color: 'red',
                  },
                  Pending: {
                    color: 'yellow',
                  },
                  Normal: {
                    color: 'green',
                  },
                  NoData: {
                    color: 'blue',
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
      name: key,
    };

    frame.fields.forEach((field) => {
      field.display = getDisplayProcessor({ field, theme });
    });

    return frame;
  });

  const frameSubset = take(dataFrames, 10);
  frameSubsetRef.current = frameSubset;

  return (
    <div className={styles.fullSize}>
      {!isEmpty(commonLabels) && (
        <Stack direction="row" alignItems="center">
          <strong>Common labels</strong>
          <TagList tags={commonLabels.map((label) => label.join('='))} />
        </Stack>
      )}
      <div style={{ flex: 1 }}>
        <AutoSizer>
          {({ width, height }) => (
            <TimelineChart
              frames={frameSubset}
              timeRange={timeRange}
              timeZone={'browser'}
              mode={TimelineMode.Changes}
              // TODO do the math to get a good height
              height={height}
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
                { label: 'Normal', color: 'green', yAxis: 1 },
                { label: 'Pending', color: 'yellow', yAxis: 1 },
                { label: 'Alerting', color: 'red', yAxis: 1 },
                { label: 'NoData', color: 'blue', yAxis: 1 },
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
                          const currentPointer = pointerSubject.current.getValue();
                          pointerSubject.current.next({ ...currentPointer, seriesIdx });
                          // setCursorState(prev => ({...prev, seriesIdx}));
                        }
                        // console.log('Series Index: ', seriesIdx)
                        // this one returns a number and gives us the ID for what series we are hovering over
                      },
                      (pointIdx) => {
                        if (pointIdx) {
                          const currentPointer = pointerSubject.current.getValue();
                          pointerSubject.current.next({ ...currentPointer, pointIdx });
                          // setCursorState(prev => ({...prev, pointIdx}));
                        }
                        // this is supposed to be the X-axis ID for the timestamp but it's always 0
                        // console.log('Point Index: ', pointIdx);
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
      </div>
      <LogRecordViewerByTimestamp records={linesWithTimestamp} commonLabels={commonLabels} logsRef={logsRef} />
    </div>
  );
};

interface LogRecordViewerProps {
  records: LogRecord[];
  commonLabels: Array<[string, string]>;
  logsRef: React.MutableRefObject<HTMLDivElement[]>;
}

function LogRecordViewerByInstance({ records, commonLabels, logsRef }: LogRecordViewerProps) {
  const styles = useStyles2(getStyles);

  const groupedLines = groupBy(records, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  return (
    <>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <Stack direction="column" key={key}>
            <h4>
              <TagList
                tags={omitLabels(Object.entries(records[0].line.labels), commonLabels).map(
                  ([key, value]) => `${key}=${value}`
                )}
              />
            </h4>
            <div className={styles.logsContainer}>
              {records.map((logRecord) => (
                <div key={uniqueId()} ref={(ref) => ref && logsRef.current.push(ref)}>
                  <AlertStateTag state={logRecord.line.previous} size="sm" muted />
                  <Icon name="arrow-right" />
                  <AlertStateTag state={logRecord.line.current} />
                  <Stack direction="row">{renderValues(logRecord.line.values)}</Stack>
                  <div>{dateTimeFormat(logRecord.timestamp)}</div>
                </div>
              ))}
            </div>
          </Stack>
        );
      })}
    </>
  );
}

function LogRecordViewerByTimestamp({ records, commonLabels, logsRef }: LogRecordViewerProps) {
  const styles = useStyles2(getStyles);

  const groupedLines = groupBy(records, (record: LogRecord) => record.timestamp);

  return (
    <div className={styles.logsScrollable}>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <div id={key} key={key} ref={(element) => element && logsRef.current.push(element)}>
            <div>
              <Timestamp time={parseInt(key, 10)} />
              <div className={styles.logsContainer}>
                {records.map((logRecord) => (
                  <React.Fragment key={uniqueId()}>
                    <AlertStateTag state={logRecord.line.previous} size="sm" muted />
                    <Icon name="arrow-right" />
                    <AlertStateTag state={logRecord.line.current} />
                    <Stack direction="row">{renderValues(logRecord.line.values)}</Stack>
                    <div>
                      <TagList
                        tags={omitLabels(Object.entries(logRecord.line.labels), commonLabels).map(
                          ([key, value]) => `${key}=${value}`
                        )}
                      />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TimestampProps {
  time: number; // epoch timestamp
}

const Timestamp = ({ time }: TimestampProps) => {
  const dateTime = new Date(time);
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.timestampWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Icon name="clock-nine" />
        <span className={styles.timestampText}>{dateTimeFormat(dateTime)}</span>
        <small>({formatDistanceToNowStrict(dateTime)} ago)</small>
      </Stack>
    </div>
  );
};

function extractCommonLabels(groupedLines: Record<string, LogRecord[]>): Array<[string, string]> {
  const groupLabels = Object.keys(groupedLines);
  const groupLabelsArray: Array<[string, string]> = groupLabels.flatMap((label) => Object.entries(JSON.parse(label)));

  // find all common labels by looking and which ones occur in every record, then create a unique array of items for those
  const commonLabels = uniqBy(
    groupLabelsArray.filter((label) => {
      const count = groupLabelsArray.filter((l) => isEqual(label, l)).length;
      return count === Object.keys(groupedLines).length;
    }),
    (label) => JSON.stringify(label)
  );

  return commonLabels;
}

// omit "common" labels from "labels"
function omitLabels(labels: Array<[string, string]>, common: Array<[string, string]>): Array<[string, string]> {
  return labels.filter((label) => {
    return !common.find((l) => JSON.stringify(l) === JSON.stringify(label));
  });
}

function renderValues(record: Record<string, number>): JSX.Element[] {
  const values = Object.entries(record);

  return values.map(([key, value]) => {
    return <Label key={key} label={key} value={value} />;
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  logsContainer: css`
    display: grid;
    grid-template-columns: max-content max-content max-content auto max-content;
    gap: ${theme.spacing(2, 1)};
    align-items: center;
  `,
  fullSize: css`
    min-width: 100%;
    height: 100%;
    overflow: hidden;

    display: flex;
    flex-direction: column;
  `,
  logsScrollable: css`
    height: 500px;
    overflow: scroll;

    flex: 1;
  `,
  timestampWrapper: css`
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(2)} 0;
  `,
  timestampText: css`
    color: ${theme.colors.text.primary};
    font-weight: ${theme.typography.fontWeightBold};
  `,
});

export default LokiStateHistory;
