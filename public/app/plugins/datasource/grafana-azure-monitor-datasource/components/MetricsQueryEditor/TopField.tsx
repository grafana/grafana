import React, { useCallback, useState } from 'react';
import { Input } from '@grafana/ui';

import { Field } from '../Field';
import { AzureQueryEditorFieldProps } from '../../types';

const TopField: React.FC<AzureQueryEditorFieldProps> = ({ onQueryChange, query }) => {
  const [value, setValue] = useState<string>(query.azureMonitor?.top ?? '');

  // As calling onQueryChange initiates a the datasource refresh, we only want to call it once
  // the field loses focus
  const handleChange = useCallback((ev: React.FormEvent) => {
    if (ev.target instanceof HTMLInputElement) {
      setValue(ev.target.value);
    }
  }, []);

  const handleBlur = useCallback(() => {
    onQueryChange({
      ...query,
      azureMonitor: {
        ...query.azureMonitor,
        top: value,
      },
    });
  }, [onQueryChange, query, value]);

  return (
    <Field label="Top">
      <Input
        id="azure-monitor-metrics-top-field"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        width={16}
      />
    </Field>
  );
};

export default TopField;
