import React from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps } from '../common';

interface AggregationFieldProps extends MetricsQueryEditorFieldProps {
  aggregationOptions: string[];
}

const AggregationField: React.FC<AggregationFieldProps> = ({ query, onChange, aggregationOptions }) => {
  const options = aggregationOptions.map((v) => ({ value: v, label: v }));

  return (
    <InlineField label="Aggregation" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.aggregation)}
        onChange={(v) => onChange('aggregation', v)}
        options={options}
      />
    </InlineField>
  );
};

export default AggregationField;
