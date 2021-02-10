import React, { useCallback } from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { findOption } from '../common';
import { SelectableValue } from '@grafana/data';
import { AzureQueryEditorFieldProps, Option } from '../../types';

interface AggregationFieldProps extends AzureQueryEditorFieldProps {
  aggregationOptions: Option[];
}

const AggregationField: React.FC<AggregationFieldProps> = ({ query, onQueryChange, aggregationOptions }) => {
  const handleChange = useCallback(
    (change: SelectableValue<string>) => {
      if (!change.value) {
        return;
      }

      onQueryChange({
        ...query,
        azureMonitor: {
          ...query.azureMonitor,
          aggregation: change.value,
        },
      });
    },
    [query]
  );

  return (
    <Field label="Aggregation">
      <Select
        value={findOption(aggregationOptions, query.azureMonitor.aggregation)}
        onChange={handleChange}
        options={aggregationOptions}
        width={38}
      />
    </Field>
  );
};

export default AggregationField;
