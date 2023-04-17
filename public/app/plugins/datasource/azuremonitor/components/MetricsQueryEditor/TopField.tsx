import React, { useCallback, useState } from 'react';

import { Input } from '@grafana/ui';

import { AzureQueryEditorFieldProps } from '../../types';
import { Field } from '../Field';

import { setTop } from './setQueryValue';

const TopField = ({ onQueryChange, query }: AzureQueryEditorFieldProps) => {
  const [value, setValue] = useState<string>(query.azureMonitor?.top ?? '');

  // As calling onQueryChange initiates a the datasource refresh, we only want to call it once
  // the field loses focus
  const handleChange = useCallback((ev: React.FormEvent) => {
    if (ev.target instanceof HTMLInputElement) {
      setValue(ev.target.value);
    }
  }, []);

  const handleBlur = useCallback(() => {
    const newQuery = setTop(query, value);
    onQueryChange(newQuery);
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
