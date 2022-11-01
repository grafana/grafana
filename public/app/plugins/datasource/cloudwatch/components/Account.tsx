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
        if (!accounts.length && query.accountId) {
          onChange(undefined);
          return [];
        }

        const options = accounts.map((a) => ({
          label: `${a.label}${a.isMonitoringAccount ? ' (Monitoring account)' : ''}`,
          value: a.id,
          description: a.id,
        }));

        if (!options.find((o) => o.value === query?.accountId)) {
          onChange(allOption.value);
        }
        return options.length ? [allOption, ...options] : options;
      })
      .catch(() => {
        query.accountId && onChange(undefined);
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

  const value = state.value?.find((a) => a.value === query.accountId);

  return (
    <EditorField label="Account" width={26}>
      <Select
        isLoading={state.loading}
        aria-label="Account"
        value={value}
        options={state.value}
        onChange={({ value: accountId }) => accountId && onChange(accountId)}
      />
    </EditorField>
  );
}
