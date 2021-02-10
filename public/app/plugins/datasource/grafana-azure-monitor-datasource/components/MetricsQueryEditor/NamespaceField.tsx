import React, { useCallback, useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, Option } from '../../types';

const NamespaceField: React.FC<AzureQueryEditorFieldProps> = ({ query, datasource, subscriptionId, onQueryChange }) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup)) {
      options.length > 0 && setOptions([]);
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

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          metricDefinition: change.value,
          resourceName: 'select',
          metricNamespace: 'select',
          metricName: 'select',
          aggregation: '',
          timeGrain: '',
          dimensionFilters: [],
        },
      });
    },
    [query]
  );

  return (
    <Field label="Namespace">
      {/* It's expected that the label reads Namespace but the property is metricDefinition */}
      <Select
        value={findOption(options, query.azureMonitor.metricDefinition)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default NamespaceField;
