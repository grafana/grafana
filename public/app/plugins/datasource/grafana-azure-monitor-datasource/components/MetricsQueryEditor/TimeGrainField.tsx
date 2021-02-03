import React, { useMemo } from 'react';

import { InlineField, Select } from '@grafana/ui';
import { findOption, MetricsQueryEditorFieldProps, toOption } from '../common';
import { MetricMetadata } from '../metrics';

interface TimeGrainFieldProps extends MetricsQueryEditorFieldProps {
  timeGrainOptions: MetricMetadata['timeGrains'];
}

const TimeGrainField: React.FC<TimeGrainFieldProps> = ({ query, onChange, timeGrainOptions }) => {
  const options = useMemo(() => timeGrainOptions.map(toOption), [timeGrainOptions]);

  return (
    <InlineField label="Time Grain" labelWidth={16}>
      <Select
        value={findOption(options, query.azureMonitor.timeGrain)}
        onChange={(v) => onChange('timeGrain', v)}
        options={options}
      />
    </InlineField>
  );
};

export default TimeGrainField;
