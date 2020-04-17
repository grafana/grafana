import React, { FC } from 'react';
import { OrgRole } from '@grafana/data';
import { Select, FormInputSize } from '@grafana/ui';

interface Props {
  value: OrgRole;
  size?: FormInputSize;
  onChange: (role: OrgRole) => void;
}

const options = Object.keys(OrgRole).map(key => ({ label: key, value: key }));

export const OrgRolePicker: FC<Props> = ({ value, onChange, size }) => (
  <Select
    size={size}
    value={value}
    options={options}
    onChange={val => onChange(val.value as OrgRole)}
    placeholder="Choose role..."
  />
);
