import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { AzureMonitorQuery, AzureQueryType } from '../types';
import { toOption, findOption } from './common';
import { Field } from './Field';
import { AzureQueryEditorFieldProps, Option } from '../types';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const SubscriptionField: React.FC<SubscriptionFieldProps> = ({ datasource, onQueryChange, query }) => {
  const [subscriptions, setSubscriptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    console.log('SubscriptionField effect ');

    datasource.azureMonitorDatasource.getSubscriptions().then((results) => {
      console.log('getSubscriptions results', results);
      const newSubscriptions = results.map(toOption);
      setSubscriptions(newSubscriptions);

      // TODO: how much of this is needed?
      // let newSubscription: string;

      // if (!query.subscription && query.queryType === 'Azure Monitor') {
      //   newSubscription = datasource.azureMonitorDatasource.subscriptionId;
      // } else if (!query.subscription && query.queryType === 'Azure Log Analytics') {
      //   newSubscription = datasource.azureLogAnalyticsDatasource.logAnalyticsSubscriptionId;
      // }

      // if (!query.subscription && this.subscriptions.length > 0) {
      //   newSubscription = this.subscriptions[0].value;
      // }
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
