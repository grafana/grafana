import { css } from '@emotion/css';
import React from 'react';
import { useEffectOnce } from 'react-use';

import { CloudWatchDatasource } from '../../datasource';
import { useAccountOptions } from '../../hooks';
import { DescribeLogGroupsRequest, LogGroup } from '../../types';

import { LogGroupsSelector } from './LogGroupsSelector';
import { SelectedLogGroups } from './SelectedLogGroups';

type Props = {
  datasource: CloudWatchDatasource;
  onChange: (logGroups: LogGroup[]) => void;
  legacyLogGroupNames?: string[];
  logGroups?: LogGroup[];
  region: string;
  maxNoOfVisibleLogGroups?: number;
};

const rowGap = css`
  gap: 3px;
`;

export const LogGroupsField = ({
  datasource,
  onChange,
  legacyLogGroupNames,
  logGroups,
  region,
  maxNoOfVisibleLogGroups,
}: Props) => {
  const accountState = useAccountOptions(datasource.api, region);

  useEffectOnce(() => {
    // If log group names are stored in the query model, make a new DescribeLogGroups request for each log group to load the arn. Then update the query model.
    if (!logGroups?.length && legacyLogGroupNames?.length) {
      Promise.all(
        legacyLogGroupNames.map((lg) => datasource.api.describeLogGroups({ region: region, logGroupNamePrefix: lg }))
      ).then((results) => {
        onChange(
          results.flatMap((r) =>
            r.map((lg) => ({
              arn: lg.value.arn,
              name: lg.value.name,
              accountId: lg.accountId,
            }))
          )
        );
      });
    }
  });

  return (
    <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
      <LogGroupsSelector
        fetchLogGroups={(params: Partial<DescribeLogGroupsRequest>) =>
          datasource.api.describeLogGroups({ region: region, ...params })
        }
        onChange={onChange}
        accountOptions={accountState.value}
        selectedLogGroups={logGroups}
      />
      <SelectedLogGroups
        selectedLogGroups={logGroups ?? []}
        onChange={onChange}
        maxNoOfVisibleLogGroups={maxNoOfVisibleLogGroups}
      ></SelectedLogGroups>
    </div>
  );
};
