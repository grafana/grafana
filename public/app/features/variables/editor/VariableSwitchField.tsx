import React, { ChangeEvent, PropsWithChildren, ReactElement } from 'react';

import { Field, Switch } from '@grafana/ui';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';
interface VariableSwitchFieldProps {
  value: boolean;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  description?: React.ReactNode;
  ariaLabel?: string;
}

export function VariableSwitchField({
  value,
  name,
  description,
  onChange,
  ariaLabel,
}: PropsWithChildren<VariableSwitchFieldProps>): ReactElement {
  const uniqueId = useUniqueId();
  return (
    <Field label={name} description={description}>
      <Switch id={`var-switch-${uniqueId}`} label={name} value={value} onChange={onChange} aria-label={ariaLabel} />
    </Field>
  );
}
