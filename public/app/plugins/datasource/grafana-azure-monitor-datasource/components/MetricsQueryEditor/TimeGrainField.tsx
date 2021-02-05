import React from 'react';
import { Select } from '@grafana/ui';

import { Field } from '../Field';
import { Option, findOption, MetricsQueryEditorFieldProps } from '../common';

interface TimeGrainFieldProps extends MetricsQueryEditorFieldProps {
  timeGrainOptions: Option[];
}

const TimeGrainField: React.FC<TimeGrainFieldProps> = ({ query, onChange, timeGrainOptions }) => {
  return (
    <Field label="Time Grain" labelWidth={16}>
      <Select
        value={findOption(timeGrainOptions, query.azureMonitor.timeGrain)}
        onChange={(v) => v.value && onChange('timeGrain', v.value)}
        options={timeGrainOptions}
        width={38}
      />
    </Field>
  );
};

export default TimeGrainField;
