import React, { ChangeEvent, PropsWithChildren, ReactElement } from 'react';
import { InlineField, InlineSwitch } from '@grafana/ui';
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
  return (
    <InlineField label={name} labelWidth={20} tooltip={tooltip}>
      <InlineSwitch label={name} value={value} onChange={onChange} aria-label={ariaLabel} />
    </InlineField>
  );
}
