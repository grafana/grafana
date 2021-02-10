import React, { useCallback, useEffect, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import { Field } from '../Field';
import { findOption, toOption } from '../common';
import { AzureQueryEditorFieldProps, Option } from '../../types';

const ResourceGroupsField: React.FC<AzureQueryEditorFieldProps> = ({
  query,
  datasource,
  subscriptionId,
  onQueryChange,
}) => {
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    if (!subscriptionId) {
      options.length > 0 && setOptions([]);
      return;
    }

    datasource
      .getResourceGroups(subscriptionId)
      .then((results) => setOptions(results.map(toOption)))
      .catch((err) => {
        // TODO: handle error
        console.error(err);
      });
  }, [subscriptionId]);

  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          resourceGroup: change.value,
          metricDefinition: 'select',
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
    <Field label="Resource Group">
      <Select
        value={findOption(options, query.azureMonitor.resourceGroup)}
        onChange={handleChange}
        options={options}
        width={38}
      />
    </Field>
  );
};

export default ResourceGroupsField;
