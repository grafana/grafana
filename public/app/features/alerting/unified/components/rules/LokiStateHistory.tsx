import { css } from '@emotion/css';
import { subMinutes, getUnixTime } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import React from 'react';

import { dateTimeFormat, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Alert, Icon, TagList, UPlotChart, useStyles2 } from '@grafana/ui';
import { GrafanaAlertState, GrafanaAlertStateWithReason } from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../api/stateHistoryApi';

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

  return (
    <Stack>
      {Object.entries(groupedLines).map(([key, records]) => {
        return (
          <Stack direction="column" key={key}>
            <h4>
              <TagList tags={Object.entries(records[0].line.labels).map(([key, value]) => `${key}=${value}`)} />
            </h4>
            {/* <UPlotChart width={400} height={50} data={dataFormat} timeRange={timeRange} /> */}
            <LogRecordViewer records={records} />
            {/* <Stack direction="column">
              {records.map((logRecord) => (
                <Stack key={uniqueId()} direction="row">
                  <div>
                    {logRecord.line.previous} {'->'} {logRecord.line.current}
                  </div>
                  <div>{logRecord.timestamp}</div>
                </Stack>
              ))}
            </Stack> */}
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
          <div></div>
          <div>{dateTimeFormat(logRecord.timestamp)}</div>
        </React.Fragment>
      ))}
    </div>
  );
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
