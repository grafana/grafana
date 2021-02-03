import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const NamespaceField: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Options>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup)) {
      return;
    }

    datasource
      .getMetricDefinitions(subscriptionId, query.azureMonitor.resourceGroup)
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId, query.azureMonitor.resourceGroup]);

  return (
    <InlineField label="Namespace" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricDefinition)}
        onChange={(v) => onChange('metricDefinition', v)}
        options={options}
      />
    </InlineField>
  );
};

export default NamespaceField;
