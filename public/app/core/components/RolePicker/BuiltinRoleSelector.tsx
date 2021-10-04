import React, { FC, useCallback, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { uniqueId } from 'lodash';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { RoleRadioButton } from './RoleRadioButton';

const BuiltinRoles = ['Viewer', 'Editor', 'Admin'];
const BuiltinRoleOption: Array<SelectableValue<string>> = BuiltinRoles.map((r: string) => ({ label: r, value: r }));

interface BuiltinRoleSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const BuiltinRoleSelector: FC<BuiltinRoleSelectorProps> = ({ value, onChange, className }) => {
  const handleOnChange = useCallback(
    (option: SelectableValue) => {
      return () => {
        if (onChange) {
          onChange(option.value);
        }
      };
    },
    [onChange]
  );
  const id = uniqueId('radiogroup-');
  const groupName = useRef(id);
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.radioGroup, className)}>
      {BuiltinRoleOption.map((o, i) => {
        return (
          <RoleRadioButton
            active={value === o.value}
            key={`o.label-${i}`}
            onChange={handleOnChange(o)}
            id={`option-${o.value}-${id}`}
            name={groupName.current}
          >
            {o.label}
          </RoleRadioButton>
        );
      })}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    radioGroup: css`
      display: flex;
      flex-direction: column;
      padding: 2px;
    `,
  };
};
