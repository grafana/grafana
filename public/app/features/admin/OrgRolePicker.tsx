import React, { FC } from 'react';
import { OrgRole } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

interface Props {
  value: OrgRole;
  onChange: (role: OrgRole) => void;
}

const options = Object.keys(OrgRole).map(key => ({ label: key, value: key }));

export const OrgRolePicker: FC<Props> = ({ value, onChange }) => (
  <RadioButtonGroup options={options} onChange={onChange} value={value} />
);
