import React from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { Option, findOption, MetricsQueryEditorFieldProps } from '../common';

interface AggregationFieldProps extends MetricsQueryEditorFieldProps {
  aggregationOptions: Option[];
}

const AggregationField: React.FC<AggregationFieldProps> = ({ query, onChange, aggregationOptions }) => {
  return (
    <Field label="Aggregation" labelWidth={16}>
      <Select
        value={findOption(aggregationOptions, query.azureMonitor.aggregation)}
        onChange={(v) => v.value && onChange('aggregation', v.value)}
        options={aggregationOptions}
        width={38}
      />
    </Field>
  );
};

export default AggregationField;
