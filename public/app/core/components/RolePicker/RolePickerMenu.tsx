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

import { MENU_MAX_HEIGHT, ROLE_PICKER_SUBMENU_MIN_WIDTH } from './constants';

enum GroupType {
  fixed = 'fixed',
  custom = 'custom',
}

const BasicRoles = Object.values(OrgRole);
const BasicRoleOption: Array<SelectableValue<OrgRole>> = BasicRoles.map((r) => ({
  label: r,
  value: r,
}));

const fixedRoleGroupNames: Record<string, string> = {
  ldap: 'LDAP',
  current: 'Current org',
};

interface RolePickerMenuProps {
  basicRole?: OrgRole;
  options: Role[];
  appliedRoles: Role[];
  showGroups?: boolean;
  basicRoleDisabled?: boolean;
  showBasicRole?: boolean;
  onSelect: (roles: Role[]) => void;
  onBasicRoleSelect?: (role: OrgRole) => void;
  onUpdate: (newRoles: Role[], newBuiltInRole?: OrgRole) => void;
  updateDisabled?: boolean;
  apply?: boolean;
  offset: { vertical: number; horizontal: number };
}

export const RolePickerMenu = ({
  basicRole,
  options,
  appliedRoles,
  showGroups,
  basicRoleDisabled,
  showBasicRole,
  onSelect,
  onBasicRoleSelect,
  onUpdate,
  updateDisabled,
  offset,
  apply,
}: RolePickerMenuProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole | undefined>(basicRole);
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
    if (onBasicRoleSelect && selectedBuiltInRole) {
      onBasicRoleSelect(selectedBuiltInRole);
    }
  }, [selectedBuiltInRole, onBasicRoleSelect]);

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

  const groupSelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = optionGroups[groupType].find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length >= groupOptions!.options.length;
  };

  const groupPartiallySelected = (groupType: GroupType, group: string) => {
    const selectedGroupOptions = getSelectedGroupOptions(group);
    const groupOptions = optionGroups[groupType].find((g) => g.value === group);
    return selectedGroupOptions.length > 0 && selectedGroupOptions.length < groupOptions!.options.length;
  };

  const onChange = (option: Role) => {
    if (selectedOptions.find((role) => role.uid === option.uid)) {
      setSelectedOptions(selectedOptions.filter((role) => role.uid !== option.uid));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const onGroupChange = (groupType: GroupType, value: string) => {
    const group = optionGroups[groupType].find((g) => {
      return g.value === value;
    });
    if (groupSelected(groupType, value) || groupPartiallySelected(groupType, value)) {
      if (group) {
        setSelectedOptions(selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid)));
      }
    } else {
      if (group) {
        const groupOptions = group.options.filter((role) => role.delegatable);
        const restOptions = selectedOptions.filter((role) => !group.options.find((option) => role.uid === option.uid));
        setSelectedOptions([...restOptions, ...groupOptions]);
      }
    }
  };

  const onOpenSubMenu = (groupType: GroupType, value: string) => {
    setOpenedMenuGroup(value);
    setShowSubMenu(true);
    const group = optionGroups[groupType].find((g) => {
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
    onUpdate(selectedOptions, selectedBuiltInRole);
  };

  return (
    <div
      className={cx(
        styles.menu,
        customStyles.menuWrapper,
        { [customStyles.menuLeft]: offset.horizontal > 0 },
        css`
          bottom: ${offset.vertical > 0 ? `${offset.vertical}px` : 'unset'};
          top: ${offset.vertical < 0 ? `${Math.abs(offset.vertical)}px` : 'unset'};
        `
      )}
    >
      <div className={customStyles.menu} aria-label="Role picker menu">
        <CustomScrollbar autoHide={false} autoHeightMax={`${MENU_MAX_HEIGHT}px`} hideHorizontalTrack hideVerticalTrack>
          {showBasicRole && (
            <div className={customStyles.menuSection}>
              <div className={customStyles.groupHeader}>Basic roles</div>
              <RadioButtonGroup
                className={customStyles.basicRoleSelector}
                options={BasicRoleOption}
                value={selectedBuiltInRole}
                onChange={onSelectedBuiltinRoleChange}
                fullWidth={true}
                disabled={basicRoleDisabled}
              />
            </div>
          )}
          {!!fixedRoles.length && (
            <div className={customStyles.menuSection}>
              <div className={customStyles.groupHeader}>Fixed roles</div>
              <div className={styles.optionBody}>
                {showGroups && !!optionGroups.fixed.length
                  ? optionGroups.fixed.map((option, i) => (
                      <RoleMenuGroupOption
                        data={option}
                        key={i}
                        isSelected={
                          groupSelected(GroupType.fixed, option.value) ||
                          groupPartiallySelected(GroupType.fixed, option.value)
                        }
                        partiallySelected={groupPartiallySelected(GroupType.fixed, option.value)}
                        disabled={option.options?.every(isNotDelegatable)}
                        onChange={(group: string) => onGroupChange(GroupType.fixed, group)}
                        onOpenSubMenu={(group: string) => onOpenSubMenu(GroupType.fixed, group)}
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
                            showOnLeft={offset.horizontal > 0}
                          />
                        )}
                      </RoleMenuGroupOption>
                    ))
                  : fixedRoles.map((option, i) => (
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
          {!!customRoles.length && (
            <div className={customStyles.menuSection}>
              <div className={customStyles.groupHeader}>Custom roles</div>
              <div className={styles.optionBody}>
                {showGroups && !!optionGroups.custom.length
                  ? optionGroups.custom.map((option, i) => (
                      <RoleMenuGroupOption
                        data={option}
                        key={i}
                        isSelected={
                          groupSelected(GroupType.custom, option.value) ||
                          groupPartiallySelected(GroupType.custom, option.value)
                        }
                        partiallySelected={groupPartiallySelected(GroupType.custom, option.value)}
                        disabled={option.options?.every(isNotDelegatable)}
                        onChange={(group: string) => onGroupChange(GroupType.custom, group)}
                        onOpenSubMenu={(group: string) => onOpenSubMenu(GroupType.custom, group)}
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
                            showOnLeft={offset.horizontal > 0}
                          />
                        )}
                      </RoleMenuGroupOption>
                    ))
                  : customRoles.map((option, i) => (
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
            <Button size="sm" fill="text" onClick={onClearInternal} disabled={updateDisabled}>
              Clear all
            </Button>
            <Button size="sm" onClick={onUpdateInternal} disabled={updateDisabled}>
              {apply ? `Apply` : `Update`}
            </Button>
          </HorizontalGroup>
        </div>
      </div>
      <div ref={subMenuNode} />
    </div>
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:');
const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');

const getOptionGroups = (options: Role[]) => {
  const groupsMap: { [key: string]: Role[] } = {};
  const customGroupsMap: { [key: string]: Role[] } = {};
  options.forEach((role) => {
    const m = role.name.startsWith('fixed:') ? groupsMap : customGroupsMap;
    const groupName = getRoleGroup(role);
    if (!m[groupName]) {
      m[groupName] = [];
    }
    m[groupName].push(role);
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

  const customGroups = [];
  for (const groupName of Object.keys(customGroupsMap)) {
    const groupOptions = customGroupsMap[groupName].sort(sortRolesByName);
    customGroups.push({
      name: capitalize(groupName),
      value: groupName,
      options: groupOptions,
    });
  }

  return {
    fixed: groups.sort((a, b) => a.name.localeCompare(b.name)),
    custom: customGroups.sort((a, b) => a.name.localeCompare(b.name)),
  };
};

interface RolePickerSubMenuProps {
  options: Role[];
  selectedOptions: Role[];
  disabledOptions?: Role[];
  onSelect: (option: Role) => void;
  onClear?: () => void;
  showOnLeft?: boolean;
}

export const RolePickerSubMenu = ({
  options,
  selectedOptions,
  disabledOptions,
  onSelect,
  onClear,
  showOnLeft,
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
    <div
      className={cx(customStyles.subMenu, { [customStyles.subMenuLeft]: showOnLeft })}
      aria-label="Role picker submenu"
    >
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

interface RoleMenuOptionProps {
  data: Role;
  onChange: (value: Role) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  hideDescription?: boolean;
}

export const RoleMenuOption = React.forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps>>(
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
            <span className={customStyles.menuOptionExpand} />
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
  return role.group || 'Other';
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
      min-width: ${ROLE_PICKER_SUBMENU_MIN_WIDTH}px;

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    menuLeft: css`
      right: 0;
      flex-direction: row-reverse;
    `,
    subMenu: css`
      height: 100%;
      min-width: ${ROLE_PICKER_SUBMENU_MIN_WIDTH}px;
      display: flex;
      flex-direction: column;
      border-left: 1px solid ${theme.components.input.borderColor};

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    subMenuLeft: css`
      border-right: 1px solid ${theme.components.input.borderColor};
      border-left: unset;
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
    basicRoleSelector: css`
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
