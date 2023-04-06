import { css } from '@emotion/css';
import { getUnixTime, subMinutes } from 'date-fns';
import { groupBy, isEmpty, isEqual, sortBy, uniqBy, uniqueId } from 'lodash';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  ArrayVector,
  DataFrame,
  dateTime,
  dateTimeFormat,
  FieldType,
  getDisplayProcessor,
  GrafanaTheme2,
  TimeRange,
} from '@grafana/data';
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

  const from = getUnixTime(subMinutes(new Date(), 60));
  const { currentData: stateHistory, isLoading, isError, error } = useGetRuleHistoryQuery({ ruleUid: ruleUID, from });

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
    const recordsSorted = sortBy(records, (record) => record.timestamp);

    const frame: DataFrame = {
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: new ArrayVector(recordsSorted.map((record) => record.timestamp)),
          config: { displayName: 'Time', custom: { fillOpacity: 100 } },
        },
        {
          name: 'state',
          type: FieldType.string,
          values: new ArrayVector(recordsSorted.map((record) => record.line.current)),
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

  return (
    <div className={styles.fullWidth}>
      <Stack direction="column">
        {!isEmpty(commonLabels) && (
          <div>
            Common labels: <TagList tags={commonLabels.map((label) => label.join('='))} />
          </div>
        )}
        <AutoSizer>
          {({ width, height }) => (
            <TimelineChart
              data-testid={height}
              frames={dataFrames}
              timeRange={timeRange}
              timeZone={'browser'}
              mode={TimelineMode.Changes}
              // TODO do the math to get a good height
              height={300}
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
              ]}
            />
          )}
        </AutoSizer>
        <LogRecordViewerByTimestamp records={linesWithTimestamp} commonLabels={commonLabels} />
      </Stack>
    </div>
  );
};

interface LogRecordViewerProps {
  records: LogRecord[];
  commonLabels: Array<[string, string]>;
}

function LogRecordViewerByInstance({ records, commonLabels }: LogRecordViewerProps) {
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
                <React.Fragment key={uniqueId()}>
                  <AlertStateTag state={logRecord.line.previous} size="sm" muted />
                  <Icon name="arrow-right" />
                  <AlertStateTag state={logRecord.line.current} />
                  <Stack direction="row">{renderValues(logRecord.line.values)}</Stack>
                  <div>{dateTimeFormat(logRecord.timestamp)}</div>
                </React.Fragment>
              ))}
            </div>
          </Stack>
        );
      })}
    </>
  );
}

function LogRecordViewerByTimestamp({ records, commonLabels }: LogRecordViewerProps) {
  const styles = useStyles2(getStyles);

  const groupedLines = groupBy(records, (record: LogRecord) => {
    return record.timestamp;
  });

  return (
    <div className={styles.logsScrollable}>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <div key={key}>
            <Stack direction="column">
              <h4 id={key}>{dateTimeFormat(parseInt(key, 10))}</h4>
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
            </Stack>
          </div>
        );
      })}
    </div>
  );
}

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
  fullWidth: css`
    min-width: 100%;
  `,

  logsScrollable: css`
    height: 500px;
    overflow: scroll;
  `,
});

export default LokiStateHistory;
