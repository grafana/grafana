import React, { useEffect, useState } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption, MetricsQueryEditorFieldProps, Option, toOption } from '../common';

const NamespaceField: React.FC<MetricsQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onChange }) => {
  const [options, setOptions] = useState<Option[]>([]);

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
    <Field label="Namespace" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.metricDefinition)}
        onChange={(v) => v.value && onChange('metricDefinition', v.value)}
        options={options}
      />
    </Field>
  );
};

export default NamespaceField;
