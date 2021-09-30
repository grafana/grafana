import React, { FC } from 'react';
import { css } from '@emotion/css';
import { CustomScrollbar, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SelectBase } from '@grafana/ui/src/components/Select/SelectBase';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';

export interface Props {
  /** Primary role selected */
  role: string;
  /** Callback for returning the selected date */
  onChange: () => void;
}

export const RolePicker: FC<Props> = ({ role, onChange }) => {
  return (
    <SelectBase
      components={{ MenuList: RolePickerMenu }}
      onChange={onChange}
      value={{ label: role, value: role }}
      defaultOptions
      loadOptions={getRolesOptions}
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
}

export const RolePickerMenu: FC<RolePickerMenuProps> = (props) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { children, maxHeight, innerRef, innerProps } = props;

  return (
    <div {...innerProps} className={styles.menu} ref={innerRef} style={{ maxHeight }} aria-label="Role picker menu">
      <div className={customStyles.groupHeader}>Roles</div>
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
