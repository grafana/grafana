import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option, toOption } from '../common';

const ResourceNameField: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Option[]>([]);

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
    <Field label="Resource Name" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.resourceName)}
        onChange={(v) => v.value && onChange('resourceName', v.value)}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceNameField;
