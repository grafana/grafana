import React, { useEffect, useState } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { CloudWatchAPI } from '../api';
import { MetricStat, Account as AccountType, AccountInfo } from '../types';

export interface Props {
  onChange: (account?: AccountInfo) => void;
  query: MetricStat;
  api: CloudWatchAPI;
}

const allOption: SelectableValue<string> = {
  label: 'All',
  value: 'all',
  description: 'Target all linked accounts',
};

const crossAccount: AccountInfo = {
  crossAccount: true,
};

export function Account({ query, onChange, api }: Props) {
  const [accounts, setAccounts] = useState<AccountType[]>([]);

  const fetchAccounts = () =>
    api
      .getAccounts({ region: query.region })
      .then((accounts) => {
        if (!accounts.length && query.accountInfo) {
          onChange(undefined);
          return [];
        }

        setAccounts(accounts);
        const options = accounts.map((a) => ({
          label: `${a.label}${a.isMonitoringAccount ? ' (Monitoring account)' : ''}`,
          value: a.arn,
          description: a.id,
        }));

        if (!options.find((o) => o.value === query.accountInfo?.account?.arn)) {
          onChange(crossAccount);
        }
        return options.length ? [allOption, ...options] : options;
      })
      .catch(() => {
        query.accountInfo && onChange(undefined);
        return [];
      });

  const [state, doFetch] = useAsyncFn(fetchAccounts, [api, query.region]);

  useEffect(() => {
    if (config.featureToggles.cloudwatchCrossAccountQuerying) {
      doFetch();
    }
  }, [api, query.region, doFetch]);

  if (!config.featureToggles.cloudwatchCrossAccountQuerying) {
    return null;
  }

  if (!state.value?.length) {
    return null;
  }

  const current = state.value?.find((a) => a.value === query.accountInfo?.account?.arn);
  const value = current ?? allOption;

  return (
    <EditorField label="Account" width={26}>
      <Select
        isLoading={state.loading}
        aria-label="Account"
        value={value}
        options={state.value}
        onChange={({ value: accountArn }) => {
          accountArn &&
            onChange({
              crossAccount: false,
              account: accounts.find((a) => a.arn === accountArn),
            });
        }}
      />
    </EditorField>
  );
}
