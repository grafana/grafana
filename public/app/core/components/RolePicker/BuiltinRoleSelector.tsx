import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { OrgRole } from 'app/types';

import { getStyles } from './styles';

const BasicRoles = Object.values(OrgRole).filter((r) => r !== OrgRole.None);
const BasicRoleOption: Array<SelectableValue<OrgRole>> = BasicRoles.map((r) => ({
  label: r,
  value: r,
}));

interface Props {
  value?: OrgRole;
  onChange: (value: OrgRole) => void;
  disabled?: boolean;
  disabledMesssage?: string;
}

export const BuiltinRoleSelector = ({ value, onChange, disabled, disabledMesssage }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <RadioButtonGroup
      className={styles.basicRoleSelector}
      options={BasicRoleOption}
      value={value}
      onChange={onChange}
      fullWidth={true}
      disabled={disabled}
    />
  );
};
