import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select, MultiSelect } from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType, AzureQueryEditorFieldProps, AzureMonitorOption } from '../types';
import { findOption, findOptions } from '../utils/common';
import { Field } from './Field';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  multiSelect?: boolean;
}

const ERROR_SOURCE = 'metrics-subscription';
const SubscriptionField: React.FC<SubscriptionFieldProps> = ({
  datasource,
  query,
  variableOptionGroup,
  onQueryChange,
  setError,
  multiSelect = false,
}) => {
  const [subscriptions, setSubscriptions] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    datasource.azureMonitorDatasource
      .getSubscriptions()
      .then((results) => {
        const newSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
        setSubscriptions(newSubscriptions);
        setError(ERROR_SOURCE, undefined);

        let newSubscription = query.subscription || datasource.azureMonitorDatasource.defaultSubscriptionId;

        if (!newSubscription && newSubscriptions.length > 0) {
          newSubscription = newSubscriptions[0].value;
        }

        if (newSubscription && newSubscription !== query.subscription) {
          onQueryChange({
            ...query,
            subscription: newSubscription,
          });
        }
      })
      .catch((err) => setError(ERROR_SOURCE, err));
  }, [
    datasource.azureMonitorDatasource?.defaultSubscriptionId,
    datasource.azureMonitorDatasource,
    onQueryChange,
    query,
    setError,
  ]);

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
        // TODO: set the fields to undefined so we don't
        // get "resource group select could not be found" errors
        newQuery.azureMonitor = {
          ...newQuery.azureMonitor,
          resourceGroup: undefined,
          metricDefinition: undefined,
          metricNamespace: undefined,
          resourceName: undefined,
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

      query.subscriptions = change.map((c) => c.value ?? '');

      onQueryChange(query);
    },
    [query, onQueryChange]
  );

  const options = useMemo(() => [...subscriptions, variableOptionGroup], [subscriptions, variableOptionGroup]);

  return multiSelect ? (
    <Field label="Subscriptions">
      <MultiSelect
        isClearable
        value={findOptions(subscriptions, query.subscriptions)}
        inputId="azure-monitor-subscriptions-field"
        onChange={onSubscriptionsChange}
        options={options}
        width={38}
      />
    </Field>
  ) : (
    <Field label="Subscription">
      <Select
        value={findOption(subscriptions, query.subscription)}
        inputId="azure-monitor-subscriptions-field"
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default SubscriptionField;
