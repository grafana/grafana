import { css } from '@emotion/css';
import { getUnixTime, subMinutes } from 'date-fns';
import { groupBy, isEmpty, isEqual, uniqBy, uniqueId } from 'lodash';
import React from 'react';

import { dateTimeFormat, GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Icon, TagList, useStyles2 } from '@grafana/ui';
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

  return (
    <Stack>
      {!isEmpty(commonLabels) && (
        <>
          Common labels: <TagList tags={commonLabels.map((label) => label.join('='))} />
        </>
      )}
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
            {/* <UPlotChart width={400} height={50} data={dataFormat} timeRange={timeRange} /> */}
            <LogRecordViewer records={records} />
          </Stack>
        );
      })}
    </Stack>
  );
};

function LogRecordViewer({ records }: { records: LogRecord[] }) {
  const styles = useStyles2(getStyles);

  return (
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
  );
}

function extractCommonLabels(groupedLines: Record<string, LogRecord[]>): Array<[string, string]> {
  const groupLabels = Object.keys(groupedLines);
  const groupLabelsArray: Array<[string, string]> = groupLabels.flatMap((label) => Object.entries(JSON.parse(label)));

  // find all common labels by looking and which ones occur multiple times, then create a unique array of items for those
  const commonLabels = uniqBy(
    groupLabelsArray.filter((label) => {
      const count = groupLabelsArray.filter((l) => isEqual(label, l)).length;
      return count > 1;
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
});

export default LokiStateHistory;
