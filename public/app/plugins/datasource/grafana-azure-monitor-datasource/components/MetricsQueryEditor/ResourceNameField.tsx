import React, { useEffect, useState } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, Options, toOption } from '../common';

const ResourceNameField: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Options>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup && query.azureMonitor.metricDefinition)) {
      return;
    }

    datasource
      .getResourceNames(subscriptionId, query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition)
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId, query.azureMonitor.resourceGroup, query.azureMonitor.metricDefinition]);

  return (
    <InlineField label="Resource Name" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.resourceName)}
        onChange={(v) => onChange('resourceName', v)}
        options={options}
      />
    </InlineField>
  );
};

export default ResourceNameField;
