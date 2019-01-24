import React, { FC } from 'react';
import { Tooltip } from '@grafana/ui';

interface Props {
  label: string;
  placeholder?: string;
  name?: string;
  value?: string;
  onChange?: (evt: any) => void;
  tooltipInfo?: any;
}

export const DataSourceOptions: FC<Props> = ({ label, placeholder, name, value, onChange, tooltipInfo }) => {
  const dsOption = (
    <div className="gf-form gf-form--flex-end">
      <label className="gf-form-label">{label}</label>
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

  return tooltipInfo ? <Tooltip content={tooltipInfo}>{dsOption}</Tooltip> : dsOption;
};

export default DataSourceOptions;
