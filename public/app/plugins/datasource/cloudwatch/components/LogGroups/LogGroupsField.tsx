import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { CloudWatchDatasource } from '../../datasource';
import { useAccountOptions } from '../../hooks';
import { DescribeLogGroupsRequest, LogGroup } from '../../types';

import { LogGroupsSelector } from './LogGroupsSelector';
import { SelectedLogGroups } from './SelectedLogGroups';

type Props = {
  datasource?: CloudWatchDatasource;
  onChange: (logGroups: LogGroup[]) => void;
  legacyLogGroupNames?: string[];
  logGroups?: LogGroup[];
  region: string;
  maxNoOfVisibleLogGroups?: number;
  onBeforeOpen?: () => void;
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
  onBeforeOpen,
}: Props) => {
  const accountState = useAccountOptions(datasource?.api, region);
  const [loadingLogGroupsStarted, setLoadingLogGroupsStarted] = useState(false);

  useEffect(() => {
    // If log group names are stored in the query model, make a new DescribeLogGroups request for each log group to load the arn. Then update the query model.
    if (datasource && !loadingLogGroupsStarted && !logGroups?.length && legacyLogGroupNames?.length) {
      setLoadingLogGroupsStarted(true);
      Promise.all(
        legacyLogGroupNames.map((lg) => datasource.api.describeLogGroups({ region: region, logGroupNamePrefix: lg }))
      )
        .then((results) => {
          const a = results.flatMap((r) =>
            r.map((lg) => ({
              arn: lg.value.arn,
              name: lg.value.name,
              accountId: lg.accountId,
            }))
          );

          onChange(a);
        })
        .catch(console.error);
    }
  }, [datasource, legacyLogGroupNames, logGroups, onChange, region, loadingLogGroupsStarted]);

  return (
    <div className={`gf-form gf-form--grow flex-grow-1 ${rowGap}`}>
      <LogGroupsSelector
        fetchLogGroups={async (params: Partial<DescribeLogGroupsRequest>) =>
          datasource?.api.describeLogGroups({ region: region, ...params }) ?? []
        }
        onChange={onChange}
        accountOptions={accountState.value}
        selectedLogGroups={logGroups}
        onBeforeOpen={onBeforeOpen}
      />
      <SelectedLogGroups
        selectedLogGroups={logGroups ?? []}
        onChange={onChange}
        maxNoOfVisibleLogGroups={maxNoOfVisibleLogGroups}
      ></SelectedLogGroups>
    </div>
  );
};
