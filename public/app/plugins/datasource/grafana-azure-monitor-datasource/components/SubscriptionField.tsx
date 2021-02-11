import React, { useCallback, useEffect, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { AzureMonitorQuery, AzureQueryType, AzureQueryEditorFieldProps, Option } from '../types';
import { toOption, findOption } from './common';
import { Field } from './Field';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const SubscriptionField: React.FC<SubscriptionFieldProps> = ({ datasource, onQueryChange, query }) => {
  const [subscriptions, setSubscriptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    datasource.azureMonitorDatasource.getSubscriptions().then((results) => {
      const newSubscriptions = results.map(toOption);
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
          resourceGroup: 'select',
          metricDefinition: 'select',
          resourceName: 'select',
          metricName: 'select',
          aggregation: '',
          timeGrain: '',
          dimensionFilters: [],
        };
      }

      onQueryChange(newQuery);
    },
    [query]
  );

  return (
    <Field label="Subscription">
      <Select
        value={findOption(subscriptions, query.subscription)}
        onChange={handleChange}
        options={subscriptions.map((v) => ({ ...v, description: v.value }))}
        width={38}
      />
    </Field>
  );
};

export default SubscriptionField;
