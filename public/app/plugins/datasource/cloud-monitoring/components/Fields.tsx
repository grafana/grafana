import React, { InputHTMLAttributes, FunctionComponent } from 'react';
import { InlineFormLabel, Select, InlineField } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

export interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  tooltip?: string;
  children?: React.ReactNode;
}

export const QueryField: FunctionComponent<Partial<Props>> = ({ label, tooltip, children }) => (
  <>
    <InlineFormLabel width={9} className="query-keyword" tooltip={tooltip}>
      {label}
    </InlineFormLabel>
    {children}
  </>
);

export const QueryInlineField: FunctionComponent<Props> = ({ ...props }) => {
  return (
    <div className={'gf-form-inline'}>
      <QueryField {...props} />
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow" />
      </div>
    </div>
  );
};

interface VariableQueryFieldProps {
  onChange: (value: string) => void;
  options: SelectableValue[];
  value: string;
  label: string;
  allowCustomValue?: boolean;
}

export const VariableQueryField: FunctionComponent<VariableQueryFieldProps> = ({
  label,
  onChange,
  value,
  options,
  allowCustomValue = false,
}) => {
  return (
    <InlineField label={label} labelWidth={20}>
      <Select
        width={25}
        allowCustomValue={allowCustomValue}
        value={value}
        onChange={({ value }) => onChange(value!)}
        options={options}
      />
    </InlineField>
  );
};
