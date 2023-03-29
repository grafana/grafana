import React, { useCallback, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select, MultiSelect } from '@grafana/ui';

import { selectors } from '../e2e/selectors';
import { AzureMonitorQuery, AzureQueryEditorFieldProps, AzureMonitorOption, AzureQueryType } from '../types';
import { findOptions } from '../utils/common';

import { Field } from './Field';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  subscriptions: AzureMonitorOption[];
  multiSelect?: boolean;
}

const SubscriptionField = ({
  query,
  subscriptions,
  variableOptionGroup,
  onQueryChange,
  multiSelect = false,
}: SubscriptionFieldProps) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      let newQuery: AzureMonitorQuery = {
        ...query,
        subscription: change.value,
      };

      if (query.queryType === AzureQueryType.AzureMonitor) {
        newQuery.azureMonitor = {
          ...newQuery.azureMonitor,
          resources: undefined,
          metricNamespace: undefined,
          metricName: undefined,
          aggregation: undefined,
          timeGrain: '',
          dimensionFilters: [],
        };
      }

      onQueryChange(newQuery);
    },
    [query, onQueryChange]
  );

  const onSubscriptionsChange = useCallback(
    (change: Array<SelectableValue<string>>) => {
      if (!change) {
        return;
      }

      onQueryChange({
        ...query,
        subscriptions: change.map((c) => c.value ?? ''),
      });
    },
    [query, onQueryChange]
  );

  const options = useMemo(() => [...subscriptions, variableOptionGroup], [subscriptions, variableOptionGroup]);

  return multiSelect ? (
    <Field label="Subscriptions" data-testid={selectors.components.queryEditor.argsQueryEditor.subscriptions.input}>
      <MultiSelect
        isClearable
        value={findOptions([...subscriptions, ...variableOptionGroup.options], query.subscriptions)}
        inputId="azure-monitor-subscriptions-field"
        onChange={onSubscriptionsChange}
        options={options}
        width={38}
      />
    </Field>
  ) : (
    <Field label="Subscription" data-testid={selectors.components.queryEditor.argsQueryEditor.subscriptions.input}>
      <Select
        value={query.subscription}
        inputId="azure-monitor-subscriptions-field"
        onChange={handleChange}
        options={options}
        width={38}
        allowCustomValue
      />
    </Field>
  );
};

export default SubscriptionField;
