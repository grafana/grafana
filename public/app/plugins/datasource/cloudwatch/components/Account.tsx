import React, { useEffect } from 'react';
import { useAsyncFn } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { CloudWatchAPI } from '../api';
import { MetricStat } from '../types';

export interface Props {
  onChange: (accountId?: string) => void;
  query: MetricStat;
  api: CloudWatchAPI;
}

const allOption: SelectableValue<string> = {
  label: 'All',
  value: 'all',
  description: 'Target all linked accounts',
};

export function Account({ query, onChange, api }: Props) {
  const fetchAccounts = () =>
    api
      .getAccounts({ region: query.region })
      .then((accounts) => {
        const options = accounts.map((a) => ({
          label: `${a.label}${a.isMonitoringAccount ? ' (Monitoring account)' : ''}`,
          value: a.arn,
          description: a.accountId,
        }));

        if (!options.find((o) => o.value === query.accountArn)) {
          onChange(options?.length ? 'all' : undefined);
        }
        return options.length ? [allOption, ...options] : options;
      })
      .catch(() => {
        query.accountArn && onChange(undefined);
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

  return (
    <EditorField label="Account" width={26}>
      <Select
        isLoading={state.loading}
        aria-label="Account"
        value={state.value?.find((a) => a.value === query.accountArn)}
        options={state.value}
        onChange={({ value: account }) => {
          account && onChange(account);
        }}
      />
    </EditorField>
  );
}
