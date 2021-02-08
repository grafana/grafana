import { Select } from '@grafana/ui';
import React, { useEffect, useState } from 'react';
import { AzureMonitorQuery } from '../types';
import { Option, MetricsQueryEditorFieldProps, toOption, findOption } from './common';
import { Field } from './Field';

interface SubscriptionFieldProps extends MetricsQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
}

const SubscriptionField: React.FC<SubscriptionFieldProps> = ({ datasource, onChange, query }) => {
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

  return (
    <Field label="Subscription" labelWidth={16}>
      <Select
        value={findOption(subscriptions, query.subscription)}
        onChange={(v) => v.value && onChange('resourceName', v.value)}
        options={subscriptions.map((v) => ({ ...v, description: v.value }))}
        width={38}
      />
    </Field>
  );
};

export default SubscriptionField;
