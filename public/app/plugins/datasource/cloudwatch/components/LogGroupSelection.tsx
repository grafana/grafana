import { css } from '@emotion/css';
import React from 'react';

import { config } from '@grafana/runtime';
import { LegacyForms } from '@grafana/ui';

import { SelectableResourceValue } from '../api';
import { CloudWatchDatasource } from '../datasource';
import { useAccountOptions } from '../hooks';
import { CloudWatchLogsQuery, CloudWatchQuery, DescribeLogGroupsRequest } from '../types';

import { CrossAccountLogsQueryField } from './CrossAccountLogsQueryField';
import { LogGroupSelector } from './LogGroupSelector';

type Props = {
  datasource: CloudWatchDatasource;
  query: CloudWatchLogsQuery;
  onChange: (value: CloudWatchQuery) => void;
  onRunQuery: () => void;
};

const rowGap = css`
  gap: 3px;
`;

export const LogGroupSelection = ({ datasource, query, onChange, onRunQuery }: Props) => {
  const accountState = useAccountOptions(datasource.api, query.region);

  return (
    <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
      {config.featureToggles.cloudWatchCrossAccountQuerying && accountState?.value?.length ? (
        <CrossAccountLogsQueryField
          fetchLogGroups={(params: Partial<DescribeLogGroupsRequest>) =>
            datasource.api.describeCrossAccountLogGroups({ region: query.region, ...params })
          }
          onChange={(selectedLogGroups: SelectableResourceValue[]) => {
            onChange({ ...query, logGroups: selectedLogGroups, logGroupNames: [] });
          }}
          accountOptions={accountState.value}
          onRunQuery={onRunQuery}
          selectedLogGroups={query.logGroups ?? []} /* todo handle defaults */
        />
      ) : (
        <LegacyForms.FormField
          label="Log Groups"
          labelWidth={6}
          className="flex-grow-1"
          inputEl={
            <LogGroupSelector
              region={query.region}
              selectedLogGroups={query.logGroupNames ?? datasource.logsQueryRunner.defaultLogGroups}
              datasource={datasource}
              onChange={function (logGroupNames: string[]): void {
                onChange({ ...query, logGroupNames, logGroups: [] });
              }}
              onRunQuery={onRunQuery}
              refId={query.refId}
            />
          }
        />
      )}
    </div>
  );
};
