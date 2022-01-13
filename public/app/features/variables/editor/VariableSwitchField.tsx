import React, { ChangeEvent, PropsWithChildren, ReactElement } from 'react';
import { InlineField, InlineSwitch } from '@grafana/ui';
import { useUniqueId } from 'app/plugins/datasource/influxdb/components/useUniqueId';
interface VariableSwitchFieldProps {
  value: boolean;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  tooltip?: string;
  ariaLabel?: string;
}

export function VariableSwitchField({
  value,
  name,
  tooltip,
  onChange,
  ariaLabel,
}: PropsWithChildren<VariableSwitchFieldProps>): ReactElement {
  const uniqueId = useUniqueId();
  return (
    <InlineField label={name} labelWidth={20} tooltip={tooltip}>
      <InlineSwitch
        id={`var-switch-${uniqueId}`}
        label={name}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
      />
    </InlineField>
  );
}
