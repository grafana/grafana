import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon, RadioButtonGroup, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { OrgRole } from 'app/types';

import { getStyles } from './styles';

const BasicRoleOption: Array<SelectableValue<OrgRole>> = Object.values(OrgRole).map((r) => ({
  label: r === OrgRole.None ? 'No basic role' : r,
  value: r,
  tooltip:
    r === OrgRole.None
      ? 'This role has no permissions by default. You may still add specific permissions with the help of RBAC.'
      : undefined,
}));

interface Props {
  value?: OrgRole;
  onChange: (value: OrgRole) => void;
  disabled?: boolean;
  disabledMesssage?: string;
}

export const BuiltinRoleSelector = ({ value, onChange, disabled, disabledMesssage }: Props) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  return (
    <>
      <div className={styles.groupHeader}>
        <span style={{ marginRight: theme.spacing(1) }}>Basic roles</span>
        {disabled && disabledMesssage && (
          <Tooltip placement="right-end" interactive={true} content={<div>{disabledMesssage}</div>}>
            <Icon name="question-circle" />
          </Tooltip>
        )}
      </div>
      <RadioButtonGroup
        className={styles.basicRoleSelector}
        options={BasicRoleOption}
        value={value}
        onChange={onChange}
        fullWidth={true}
        disabled={disabled}
      />
    </>
  );
};
