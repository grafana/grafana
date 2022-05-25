import { css, cx } from '@emotion/css';
import React, { FormEvent, useEffect, useRef, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  Button,
  Checkbox,
  CustomScrollbar,
  HorizontalGroup,
  Icon,
  Portal,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { OrgRole, Role } from 'app/types';

import { MENU_MAX_HEIGHT } from './constants';

const BuiltinRoles = Object.values(OrgRole);
const BuiltinRoleOption: Array<SelectableValue<OrgRole>> = BuiltinRoles.map((r) => ({
  label: r,
  value: r,
}));

const fixedRoleGroupNames: Record<string, string> = {
  ldap: 'LDAP',
  current: 'Current org',
};

interface RolePickerMenuProps {
  builtInRole?: OrgRole;
  options: Role[];
  appliedRoles: Role[];
  showGroups?: boolean;
  builtinRolesDisabled?: boolean;
  showBuiltInRole?: boolean;
  onSelect: (roles: Role[]) => void;
  onBuiltInRoleSelect?: (role: OrgRole) => void;
  onUpdate: (newRoles: Role[], newBuiltInRole?: OrgRole) => void;
  onClear?: () => void;
  updateDisabled?: boolean;
  offset: number;
}

export const RolePickerMenu = ({
  builtInRole,
  options,
  appliedRoles,
  showGroups,
  builtinRolesDisabled,
  showBuiltInRole,
  onSelect,
  onBuiltInRoleSelect,
  onUpdate,
  onClear,
  updateDisabled,
  offset,
}: RolePickerMenuProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(builtInRole);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [openedMenuGroup, setOpenedMenuGroup] = useState('');
  const [subMenuOptions, setSubMenuOptions] = useState<Role[]>([]);
  const subMenuNode = useRef<HTMLDivElement | null>(null);
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);

  // Call onSelect() on every selectedOptions change
  useEffect(() => {
    onSelect(selectedOptions);
  }, [selectedOptions, onSelect]);

  useEffect(() => {
    if (onBuiltInRoleSelect && selectedBuiltInRole) {
      onBuiltInRoleSelect(selectedBuiltInRole);
    }
  }, [selectedBuiltInRole, onBuiltInRoleSelect]);

  const customRoles = options.filter(filterCustomRoles).sort(sortRolesByName);
  const fixedRoles = options.filter(filterFixedRoles).sort(sortRolesByName);
  const optionGroups = getOptionGroups(options);

  const getSelectedGroupOptions = (group: string) => {
    const selectedGroupOptions = [];
    for (const role of selectedOptions) {
      if (getRoleGroup(role) === group) {
        selectedGroupOptions.push(role);
      }
    }
    return selectedGroupOptions;
  };

  const groupSelected = (group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = optionGroups.find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length >= groupOptions!.options.length;
  };

  const groupPartiallySelected = (group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = optionGroups.find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length < groupOptions!.options.length;
  };

  const onChange = (option: Role) => {
    if (selectedOptions.find((role) => role.uid === option.uid)) {
      setSelectedOptions(selectedOptions.filter((role) => role.uid !== option.uid));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const onGroupChange = (value: string) => {
    const group = optionGroups.find((g) => {
      return g.value === value;
    });
    if (groupSelected(value)) {
      if (group) {
        setSelectedOptions(selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid)));
      }
    } else {
      if (group) {
        const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
        setSelectedOptions([...restOptions, ...group.options]);
      }
    }
  };

  const onOpenSubMenu = (value: string) => {
    setOpenedMenuGroup(value);
    setShowSubMenu(true);
    const group = optionGroups.find((g) => {
      return g.value === value;
    });
    if (group) {
      setSubMenuOptions(group.options);
    }
  };

  const onCloseSubMenu = (value: string) => {
    setShowSubMenu(false);
    setOpenedMenuGroup('');
    setSubMenuOptions([]);
  };

  const onSelectedBuiltinRoleChange = (newRole: OrgRole) => {
    setSelectedBuiltInRole(newRole);
  };

  const onClearInternal = async () => {
    if (onClear) {
      onClear();
    }
    setSelectedOptions([]);
  };

  const onClearSubMenu = () => {
    const options = selectedOptions.filter((role) => {
      const groupName = getRoleGroup(role);
      return groupName !== openedMenuGroup;
    });
    setSelectedOptions(options);
  };

  const onUpdateInternal = () => {
    const selectedCustomRoles: string[] = [];
    // TODO: needed?
    for (const key in selectedOptions) {
      const roleUID = selectedOptions[key]?.uid;
      selectedCustomRoles.push(roleUID);
    }
    onUpdate(selectedOptions, selectedBuiltInRole);
  };

  return (
    <div
      className={cx(
        styles.menu,
        customStyles.menuWrapper,
        css`
          bottom: ${offset > 0 ? `${offset}px` : 'unset'};
          top: ${offset < 0 ? `${Math.abs(offset)}px` : 'unset'};
        `
      )}
    >
      <div className={customStyles.menu} aria-label="Role picker menu">
        <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack hideVerticalTrack>
          {showBuiltInRole && (
            <div className={customStyles.menuSection}>
              <div className={customStyles.groupHeader}>Basic roles</div>
              <RadioButtonGroup
                className={customStyles.builtInRoleSelector}
                options={BuiltinRoleOption}
                value={selectedBuiltInRole}
                onChange={onSelectedBuiltinRoleChange}
                fullWidth={true}
                disabled={builtinRolesDisabled}
              />
            </div>
          )}
          {!!fixedRoles.length &&
            (showGroups && !!optionGroups.length ? (
              <div className={customStyles.menuSection}>
                <div className={customStyles.groupHeader}>Fixed roles</div>
                <div className={styles.optionBody}>
                  {optionGroups.map((option, i) => (
                    <RoleMenuGroupOption
                      data={option}
                      key={i}
                      isSelected={groupSelected(option.value) || groupPartiallySelected(option.value)}
                      partiallySelected={groupPartiallySelected(option.value)}
                      disabled={option.options?.every(isNotDelegatable)}
                      onChange={onGroupChange}
                      onOpenSubMenu={onOpenSubMenu}
                      onCloseSubMenu={onCloseSubMenu}
                      root={subMenuNode?.current!}
                      isFocused={showSubMenu && openedMenuGroup === option.value}
                    >
                      {showSubMenu && openedMenuGroup === option.value && (
                        <RolePickerSubMenu
                          options={subMenuOptions}
                          selectedOptions={selectedOptions}
                          onSelect={onChange}
                          onClear={onClearSubMenu}
                        />
                      )}
                    </RoleMenuGroupOption>
                  ))}
                </div>
              </div>
            ) : (
              <div className={customStyles.menuSection}>
                <div className={customStyles.groupHeader}>Fixed roles</div>
                <div className={styles.optionBody}>
                  {fixedRoles.map((option, i) => (
                    <RoleMenuOption
                      data={option}
                      key={i}
                      isSelected={!!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid))}
                      disabled={isNotDelegatable(option)}
                      onChange={onChange}
                      hideDescription
                    />
                  ))}
                </div>
              </div>
            ))}
          {!!customRoles.length && (
            <div>
              <div className={customStyles.groupHeader}>Custom roles</div>
              <div className={styles.optionBody}>
                {customRoles.map((option, i) => (
                  <RoleMenuOption
                    data={option}
                    key={i}
                    isSelected={!!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid))}
                    disabled={isNotDelegatable(option)}
                    onChange={onChange}
                    hideDescription
                  />
                ))}
              </div>
            </div>
          )}
        </CustomScrollbar>
        <div className={customStyles.menuButtonRow}>
          <HorizontalGroup justify="flex-end">
            <Button size="sm" fill="text" onClick={onClearInternal}>
              Clear all
            </Button>
            <Button size="sm" onClick={onUpdateInternal}>
              {updateDisabled ? `Apply` : `Update`}
            </Button>
          </HorizontalGroup>
        </div>
      </div>
      <div ref={subMenuNode}></div>
    </div>
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:');
const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');

const getOptionGroups = (options: Role[]) => {
  const groupsMap: { [key: string]: Role[] } = {};
  options.forEach((role) => {
    if (role.name.startsWith('fixed:')) {
      const groupName = getRoleGroup(role);
      if (groupsMap[groupName]) {
        groupsMap[groupName].push(role);
      } else {
        groupsMap[groupName] = [role];
      }
    }
  });

  const groups = [];
  for (const groupName of Object.keys(groupsMap)) {
    const groupOptions = groupsMap[groupName].sort(sortRolesByName);
    groups.push({
      name: fixedRoleGroupNames[groupName] || capitalize(groupName),
      value: groupName,
      options: groupOptions,
    });
  }
  return groups.sort((a, b) => a.name.localeCompare(b.name));
};

interface RolePickerSubMenuProps {
  options: Role[];
  selectedOptions: Role[];
  disabledOptions?: Role[];
  onSelect: (option: Role) => void;
  onClear?: () => void;
}

export const RolePickerSubMenu = ({
  options,
  selectedOptions,
  disabledOptions,
  onSelect,
  onClear,
}: RolePickerSubMenuProps): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);

  const onClearInternal = async () => {
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={customStyles.subMenu} aria-label="Role picker submenu">
      <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <RoleMenuOption
              data={option}
              key={i}
              isSelected={
                !!(
                  option.uid &&
                  (!!selectedOptions.find((opt) => opt.uid === option.uid) ||
                    disabledOptions?.find((opt) => opt.uid === option.uid))
                )
              }
              disabled={
                !!(option.uid && disabledOptions?.find((opt) => opt.uid === option.uid)) || isNotDelegatable(option)
              }
              onChange={onSelect}
              hideDescription
            />
          ))}
        </div>
      </CustomScrollbar>
      <div className={customStyles.subMenuButtonRow}>
        <HorizontalGroup justify="flex-end">
          <Button size="sm" fill="text" onClick={onClearInternal}>
            Clear
          </Button>
        </HorizontalGroup>
      </div>
    </div>
  );
};

interface RoleMenuOptionProps<T> {
  data: Role;
  onChange: (value: Role) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  hideDescription?: boolean;
}

export const RoleMenuOption = React.forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps<any>>>(
  ({ data, isFocused, isSelected, disabled, onChange, hideDescription }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);

    const wrapperClassName = cx(
      styles.option,
      isFocused && styles.optionFocused,
      disabled && customStyles.menuOptionDisabled
    );

    const onChangeInternal = (event: FormEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onChange(data);
    };

    return (
      <div ref={ref} className={wrapperClassName} aria-label="Role picker option" onClick={onChangeInternal}>
        <Checkbox
          value={isSelected}
          className={customStyles.menuOptionCheckbox}
          onChange={onChangeInternal}
          disabled={disabled}
        />
        <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
          <span>{data.displayName || data.name}</span>
          {!hideDescription && data.description && <div className={styles.optionDescription}>{data.description}</div>}
        </div>
        {data.description && (
          <Tooltip content={data.description}>
            <Icon name="info-circle" className={customStyles.menuOptionInfoSign} />
          </Tooltip>
        )}
      </div>
    );
  }
);

RoleMenuOption.displayName = 'RoleMenuOption';

interface RoleMenuGroupsOptionProps {
  data: SelectableValue<string>;
  onChange: (value: string) => void;
  onClick?: (value: string) => void;
  onOpenSubMenu?: (value: string) => void;
  onCloseSubMenu?: (value: string) => void;
  isSelected?: boolean;
  partiallySelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  root?: HTMLElement;
}

export const RoleMenuGroupOption = React.forwardRef<HTMLDivElement, RoleMenuGroupsOptionProps>(
  (
    {
      data,
      isFocused,
      isSelected,
      partiallySelected,
      disabled,
      onChange,
      onClick,
      onOpenSubMenu,
      onCloseSubMenu,
      children,
      root,
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);

    const wrapperClassName = cx(
      styles.option,
      isFocused && styles.optionFocused,
      disabled && customStyles.menuOptionDisabled
    );

    const onChangeInternal = (event: FormEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }
      if (data.value) {
        onChange(data.value);
      }
    };

    const onClickInternal = (event: FormEvent<HTMLElement>) => {
      if (onClick) {
        onClick(data.value!);
      }
    };

    const onMouseEnter = () => {
      if (onOpenSubMenu) {
        onOpenSubMenu(data.value!);
      }
    };

    const onMouseLeave = () => {
      if (onCloseSubMenu) {
        onCloseSubMenu(data.value!);
      }
    };

    return (
      <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div ref={ref} className={wrapperClassName} aria-label="Role picker option" onClick={onClickInternal}>
          <Checkbox
            value={isSelected}
            className={cx(customStyles.menuOptionCheckbox, {
              [customStyles.checkboxPartiallyChecked]: partiallySelected,
            })}
            onChange={onChangeInternal}
            disabled={disabled}
          />
          <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
            <span>{data.displayName || data.name}</span>
            <span className={customStyles.menuOptionExpand}></span>
          </div>
          {root && children && (
            <Portal className={customStyles.subMenuPortal} root={root}>
              {children}
            </Portal>
          )}
        </div>
      </div>
    );
  }
);

RoleMenuGroupOption.displayName = 'RoleMenuGroupOption';

const getRoleGroup = (role: Role) => {
  return role.group ?? 'Other';
};

const capitalize = (s: string): string => {
  return s.slice(0, 1).toUpperCase() + s.slice(1);
};

const sortRolesByName = (a: Role, b: Role) => a.name.localeCompare(b.name);

const isNotDelegatable = (role: Role) => {
  return role.delegatable !== undefined && !role.delegatable;
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    menuWrapper: css`
      display: flex;
      max-height: 650px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
      min-width: auto;
    `,
    menu: css`
      min-width: 260px;

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    subMenu: css`
      height: 100%;
      min-width: 260px;
      display: flex;
      flex-direction: column;
      border-left-style: solid;
      border-left-width: 1px;
      border-left-color: ${theme.components.input.borderColor};

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    groupHeader: css`
      padding: ${theme.spacing(0, 4)};
      display: flex;
      align-items: center;
      color: ${theme.colors.text.primary};
      font-weight: ${theme.typography.fontWeightBold};
    `,
    container: css`
      padding: ${theme.spacing(1)};
      border: 1px ${theme.colors.border.weak} solid;
      border-radius: ${theme.shape.borderRadius(1)};
      background-color: ${theme.colors.background.primary};
      z-index: ${theme.zIndex.modal};
    `,
    menuSection: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    menuOptionCheckbox: css`
      display: flex;
      margin: ${theme.spacing(0, 1, 0, 0.25)};
    `,
    menuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
    menuOptionBody: css`
      font-weight: ${theme.typography.fontWeightRegular};
      padding: ${theme.spacing(0, 1.5, 0, 0)};
    `,
    menuOptionDisabled: css`
      color: ${theme.colors.text.disabled};
      cursor: not-allowed;
    `,
    menuOptionExpand: css`
      position: absolute;
      right: ${theme.spacing(1.25)};
      color: ${theme.colors.text.disabled};

      &:after {
        content: '>';
      }
    `,
    menuOptionInfoSign: css`
      color: ${theme.colors.text.disabled};
    `,
    builtInRoleSelector: css`
      margin: ${theme.spacing(1, 1.25, 1, 1)};
    `,
    subMenuPortal: css`
      height: 100%;
      > div {
        height: 100%;
      }
    `,
    subMenuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
    checkboxPartiallyChecked: css`
      input {
        &:checked + span {
          &:after {
            border-width: 0 3px 0px 0;
            transform: rotate(90deg);
          }
        }
      }
    `,
  };
};
