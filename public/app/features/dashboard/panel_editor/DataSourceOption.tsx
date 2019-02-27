import React, { FC } from 'react';
import { FormLabel } from '@grafana/ui';

interface Props {
  label: string;
  placeholder?: string;
  name?: string;
  value?: string;
  onChange?: (evt: any) => void;
  tooltipInfo?: any;
}

export const DataSourceOptions: FC<Props> = ({ label, placeholder, name, value, onChange, tooltipInfo }) => {
  return (
    <div className="gf-form gf-form--flex-end">
      <FormLabel tooltip={tooltipInfo}>{label}</FormLabel>
      <input
        type="text"
        className="gf-form-input width-6"
        placeholder={placeholder}
        name={name}
        spellCheck={false}
        onBlur={evt => onChange(evt.target.value)}
      />
    </div>
  );
};

export default DataSourceOptions;
