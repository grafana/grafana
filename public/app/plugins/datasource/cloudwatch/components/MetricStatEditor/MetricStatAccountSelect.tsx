import React, { useEffect } from 'react';

import { CloudWatchAPI } from '../../api';
import { useAccountOptions } from '../../hooks';
import { MetricStat } from '../../types';
import { Account } from '../Account';

type Props = {
  api: Pick<CloudWatchAPI, 'getAccounts' | 'templateSrv' | 'getVariables'>;
  metricStat: MetricStat;
  onChange: (value: MetricStat) => void;
  onRunQuery: () => void;
};

export const MetricStatAccountSelect = (props: Props) => {
  const accountState = useAccountOptions(props.api, props.metricStat.region);
  useEffect(() => {
    if (!accountState.loading && accountState.value) {
      if (accountState.value.length === 0 && props.metricStat.accountId) {
        props.onChange({ ...props.metricStat, accountId: '' });
      }
      if (accountState.value.length > 0 && !props.metricStat.accountId) {
        props.onChange({ ...props.metricStat, accountId: 'all' });
      }
    }

    if (accountState.error && props.metricStat.accountId) {
      props.onChange({ ...props.metricStat, accountId: '' });
    }
  }, [accountState, props]);

  return (
    <Account
      accountId={props.metricStat.accountId}
      onChange={(accountId?: string) => {
        props.onChange({ ...props.metricStat, accountId });
        props.onRunQuery();
      }}
      accountOptions={accountState?.value || []}
    ></Account>
  );
};
