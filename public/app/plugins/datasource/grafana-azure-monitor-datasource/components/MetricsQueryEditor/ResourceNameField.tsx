import React, { useCallback, useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, Option } from '../../types';

const ResourceNameField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onQueryChange,
}) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!(subscriptionId && query.azureMonitor.resourceGroup && query.azureMonitor.metricDefinition)) {
      options.length > 0 && setOptions([]);
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

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          resourceName: change.value,

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
    <Field label="Resource Name">
      <Select
        value={findOption(options, query.azureMonitor.resourceName)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceNameField;
