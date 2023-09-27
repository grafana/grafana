import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon, RadioButtonGroup, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
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
