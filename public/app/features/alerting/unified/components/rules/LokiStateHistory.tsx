import { subMinutes, getUnixTime } from 'date-fns';
import { groupBy, uniqueId } from 'lodash';
import React from 'react';

import { Stack } from '@grafana/experimental';
import { Alert, TagList } from '@grafana/ui';

import { stateHistoryApi } from '../../api/stateHistoryApi';

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

  interface Line {
    previous: string;
    current: string;
    values: Record<string, number>;
    labels: Record<string, string>;
  }

  interface LogRecord {
    timestamp: number;
    line: Line;
  }

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
      {Object.entries(groupedLines).map(([key, records]) => (
        <Stack direction="column" key={key}>
          <h4>
            <TagList tags={Object.entries(records[0].line.labels).map(([key, value]) => `${key}=${value}`)} />
          </h4>
          <Stack direction="column">
            {records.map((logRecord) => (
              <Stack key={uniqueId()} direction="row">
                <div>
                  {logRecord.line.previous} {'->'} {logRecord.line.current}
                </div>
                <div>{logRecord.timestamp}</div>
              </Stack>
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
};

export default LokiStateHistory;
