import { subMinutes, getUnixTime } from 'date-fns';
import { groupBy } from 'lodash';
import React from 'react';

import { Stack } from '@grafana/experimental';
import { Alert } from '@grafana/ui';

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

  type Line = {
    labels: Record<string, string>;
  };

  type LogRecord = {
    timestamp: number;
    line: Line;
  };

  const linesWithTimestamp = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
    // @ts-ignore
    const line: Line = lines[index];
    acc.push({ timestamp, line });

    return acc;
  }, []);

  const groupedLines = groupBy(linesWithTimestamp, (record: LogRecord) => {
    return JSON.stringify(record.line.labels);
  });

  return (
    <Stack>
      :
      <code>
        <pre>{JSON.stringify(groupedLines, null, 2)}</pre>
      </code>
    </Stack>
  );
};

export default LokiStateHistory;
