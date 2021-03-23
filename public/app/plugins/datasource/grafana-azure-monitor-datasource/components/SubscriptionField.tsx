import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType, AzureQueryEditorFieldProps, AzureMonitorOption } from '../types';
import { findOption } from './common';
import { Field } from './Field';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const SubscriptionField: React.FC<SubscriptionFieldProps> = ({
  datasource,
  query,
  variableOptionGroup,
  onQueryChange,
}) => {
  const [subscriptions, setSubscriptions] = useState<AzureMonitorOption[]>([]);

  useEffect(() => {
    if (!datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    datasource.azureMonitorDatasource.getSubscriptions().then((results) => {
      const newSubscriptions = results.map((v) => ({ label: v.text, value: v.value, description: v.value }));
      setSubscriptions(newSubscriptions);

      // Set a default subscription ID, if we can
      let newSubscription = query.subscription;

      if (!newSubscription && query.queryType === AzureQueryType.AzureMonitor) {
        newSubscription = datasource.azureMonitorDatasource.subscriptionId;
      } else if (!query.subscription && query.queryType === AzureQueryType.LogAnalytics) {
        newSubscription =
          datasource.azureLogAnalyticsDatasource.logAnalyticsSubscriptionId ||
          datasource.azureLogAnalyticsDatasource.subscriptionId;
      }

      if (!newSubscription && newSubscriptions.length > 0) {
        newSubscription = newSubscriptions[0].value;
      }

      newSubscription !== query.subscription &&
        onQueryChange({
          ...query,
          subscription: newSubscription,
        });
    });
  }, []);

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
          resourceGroup: undefined,
          metricDefinition: undefined,
          metricNamespace: undefined,
          resourceName: undefined,
          metricName: undefined,
          aggregation: '',
          timeGrain: '',
          dimensionFilters: [],
        };
      }

      onQueryChange(newQuery);
    },
    [query, onQueryChange]
  );

  const options = useMemo(() => [...subscriptions, variableOptionGroup], [subscriptions, variableOptionGroup]);

  return (
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
