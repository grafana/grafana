import React, { FC } from 'react';
import { css } from '@emotion/css';
import { CustomScrollbar, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SelectBase } from '@grafana/ui/src/components/Select/SelectBase';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';
// import { getFocusStyles, getMouseFocusStyles } from '@grafana/ui/src/themes/mixins';

export interface Props {
  /** Primary role selected */
  role: string;
  onChange: () => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePicker: FC<Props> = ({ role, onChange }) => {
  return (
    <SelectBase
      components={{ MenuList: RolePickerMenu }}
      onChange={onChange}
      value={{ label: role, value: role }}
      defaultOptions
      loadOptions={getRolesOptions}
      closeMenuOnSelect={false}
    />
  );
};

const getRolesOptions = async (query: string) => {
  const roles = await getBackendSrv().get('/api/access-control/roles');
  if (!roles || !roles.length) {
    return [];
  }
  return roles.map(
    (role: Role): SelectableValue => ({
      value: role.uid,
      label: role.name,
      description: role.description,
    })
  );
};

interface RolePickerMenuProps {
  maxHeight: number;
  innerRef: React.Ref<any>;
  innerProps: {};
  // setValue: (newValue: any, action: any) => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePickerMenu: FC<RolePickerMenuProps> = (props) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { children, maxHeight, innerRef, innerProps, onBuiltinRoleChange } = props;
  console.log(props);
  console.log((props as any).getValue());

  const valueRaw = (props as any).getValue();
  const value = valueRaw && valueRaw.length && valueRaw[0]?.value;

  return (
    <div
      {...innerProps}
      className={styles.menu}
      ref={innerRef}
      style={{ maxHeight: maxHeight * 2 }}
      aria-label="Role picker menu"
    >
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <BuiltinRoleSelector value={value} onChange={onBuiltinRoleChange} />
      <div className={styles.optionBody}></div>
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>{children}</div>
      </CustomScrollbar>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    container: css``,
    groupHeader: css`
      padding: 8px;
      display: flex;
      align-items: center;
      color: ${theme.colors.primary.text};
    `,
  };
};
