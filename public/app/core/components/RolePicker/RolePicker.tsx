import React, { FC, FormEvent, useCallback, useEffect, useState } from 'react';
import { css, cx } from '@emotion/css';
import { ClickOutsideWrapper, CustomScrollbar, Icon, IconName, Input, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { getBackendSrv } from '@grafana/runtime';
import { Role } from 'app/types';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

export interface Props {
  /** Primary role selected */
  role: string;
  onChange: (newRole: string) => void;
  onBuiltinRoleChange: (newRole: string) => void;
}

export const RolePicker: FC<Props> = ({ role, onChange, onBuiltinRoleChange }) => {
  const [isOpen, setOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);

  const styles = useStyles2(getStyles);

  useEffect(() => {
    async function fetchOptions() {
      const options = await getRolesOptions();
      setRoleOptions(options);
    }
    fetchOptions();
  }, []);

  const onApply = useCallback(
    (role: string) => {
      setOpen(false);
      onChange(role);
    },
    [onChange]
  );

  const onOpen = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      setOpen(true);
    },
    [setOpen]
  );

  return (
    <div data-testid="date-time-picker" style={{ position: 'relative' }}>
      <RolePickerInput role={role} onChange={onChange} onOpen={onOpen} />
      {isOpen && (
        <ClickOutsideWrapper onClick={() => setOpen(false)}>
          <RolePickerMenu
            onBuiltinRoleChange={onBuiltinRoleChange}
            onChange={onApply}
            onClose={() => setOpen(false)}
            options={roleOptions}
            builtInRole={role}
          />
          <div className="" onClick={stopPropagation} />
        </ClickOutsideWrapper>
      )}
    </div>
  );
};

const getRolesOptions = async (query?: string) => {
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
  builtInRole: string;
  options: Array<SelectableValue<string>>;
  onChange: (newRole: string) => void;
  // setValue: (newValue: any, action: any) => void;
  onBuiltinRoleChange: (newRole: string) => void;
  onClose: () => void;
}

export const RolePickerMenu: FC<RolePickerMenuProps> = (props) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { builtInRole, options, onChange, onBuiltinRoleChange } = props;
  console.log(props);

  return (
    <div
      // {...innerProps}
      className={cx(styles.menu, customStyles.menu)}
      // ref={innerRef}
      // style={{ maxHeight: 500, position: 'absolute', zIndex: theme.zIndex.dropdown, overflow: 'hidden' }}
      aria-label="Role picker menu"
    >
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <BuiltinRoleSelector value={builtInRole} onChange={onBuiltinRoleChange} />
      <div className={styles.optionBody}></div>
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <SelectMenuOptions data={option} key={i} />
          ))}
        </div>
      </CustomScrollbar>
    </div>
  );
};

interface SelectMenuOptionProps<T> {
  // isDisabled: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  // innerProps: any;
  data: SelectableValue<T>;
}

export const SelectMenuOptions = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuOptionProps<any>>>(
  (props, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const { children, data, isFocused, isSelected } = props;

    return (
      <div
        ref={ref}
        className={cx(styles.option, isFocused && styles.optionFocused, isSelected && styles.optionSelected)}
        // {...innerProps}
        aria-label="Select option"
      >
        {data.icon && <Icon name={data.icon as IconName} className={styles.optionIcon} />}
        {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} />}
        <div className={styles.optionBody}>
          <span>{data.label}</span>
          {data.description && <div className={styles.optionDescription}>{data.description}</div>}
          {data.component && <data.component />}
        </div>
      </div>
    );
  }
);

SelectMenuOptions.displayName = 'SelectMenuOptions';

interface InputProps {
  role?: string;
  onChange: (role?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
}

export const RolePickerInput: FC<InputProps> = ({ role, onChange, onOpen }) => {
  const [internalRole] = useState(() => {
    return role;
  });

  const onFocus = useCallback(
    (event: FormEvent<HTMLElement>) => {
      onOpen(event);
    },
    [onOpen]
  );

  const onBlur = useCallback(() => {
    onChange(internalRole);
  }, [internalRole, onChange]);

  return (
    <Input
      onClick={stopPropagation}
      // onChange={onChangeDate}
      value={internalRole}
      onFocus={onFocus}
      onBlur={onBlur}
      data-testid="date-time-input"
      placeholder="Select date/time"
    />
  );
};

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
  return {
    menu: css`
      max-height: 500;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
    `,
    groupHeader: css`
      padding: 8px;
      display: flex;
      align-items: center;
      color: ${theme.colors.primary.text};
    `,
    container: css`
      padding: ${theme.spacing(1)};
      border: 1px ${theme.colors.border.weak} solid;
      border-radius: ${theme.shape.borderRadius(1)};
      background-color: ${theme.colors.background.primary};
      z-index: ${theme.zIndex.modal};
    `,
    modal: css`
      position: fixed;
      top: 25%;
      left: 25%;
      width: 100%;
      z-index: ${theme.zIndex.modal};
      max-width: 280px;
    `,
  };
};
