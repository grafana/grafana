import React, { FC } from 'react';
import { OrgRole } from '@grafana/data';
import { RadioButtonGroup, Select } from '@grafana/ui';

interface Props {
  value: OrgRole;
  type?: 'radio' | 'select';
  onChange: (role: OrgRole) => void;
}

const options = Object.keys(OrgRole).map(key => ({ label: key, value: key }));

export const OrgRolePicker: FC<Props> = ({ value, onChange, type = 'radio' }) => {
  return type === 'select' ? (
    <Select
      value={value}
      options={options}
      onChange={val => onChange(val.value as OrgRole)}
      placeholder="Choose role..."
    />
  ) : (
    <RadioButtonGroup options={options} onChange={onChange} value={value} />
  );
};
