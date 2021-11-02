import React, { FormEvent, useState } from 'react';
import { css, cx } from '@emotion/css';
import {
  Button,
  Checkbox,
  CustomScrollbar,
  HorizontalGroup,
  RadioButtonGroup,
  Tooltip,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { OrgRole, Role } from 'app/types';

type BuiltInRoles = { [key: string]: Role[] };

const BuiltinRoles = ['Viewer', 'Editor', 'Admin'];
const BuiltinRoleOption: Array<SelectableValue<string>> = BuiltinRoles.map((r: string) => ({ label: r, value: r }));

interface RolePickerMenuProps {
  builtInRole: OrgRole;
  builtInRoles: BuiltInRoles;
  options: Role[];
  appliedRoles: Role[];
  onUpdate: (newBuiltInRole: OrgRole, newRoles: string[]) => void;
  onClear?: () => void;
}

export const RolePickerMenu = ({
  builtInRole,
  options,
  appliedRoles,
  onUpdate,
  onClear,
}: RolePickerMenuProps): JSX.Element => {
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState<OrgRole>(builtInRole);
  const [showSubMenu, setShowSubMenu] = useState(false);

  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);

  const onSelect = (option: Role) => {
    if (selectedOptions.find((role) => role.uid === option.uid)) {
      setSelectedOptions(selectedOptions.filter((role) => role.uid !== option.uid));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  const onMenuGroupClick = (value: string) => {
    setShowSubMenu(!showSubMenu);
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

  const onUpdateInternal = () => {
    const selectedCustomRoles: string[] = [];
    for (const key in selectedOptions) {
      const roleUID = selectedOptions[key]?.uid;
      selectedCustomRoles.push(roleUID);
    }
    onUpdate(selectedBuiltInRole, selectedCustomRoles);
  };

  const customRoles = options.filter(filterCustomRoles);
  const fixedRoles = options.filter(filterFixedRoles);

  return (
    <div className={cx(styles.menu, customStyles.menuWrapper)}>
      <div className={customStyles.menu} aria-label="Role picker menu">
        <CustomScrollbar autoHide={false} autoHeightMax="250px" hideHorizontalTrack>
          <div className={customStyles.groupHeader}>Built-in roles</div>
          <RadioButtonGroup
            className={customStyles.builtInRoleSelector}
            options={BuiltinRoleOption}
            value={selectedBuiltInRole}
            onChange={onSelectedBuiltinRoleChange}
            fullWidth={true}
          />
          {[
            { header: 'Custom roles', roles: customRoles },
            {
              header: 'Fixed roles',
              roles: fixedRoles,
              hideDescription: true,
            },
          ].map(
            (item) =>
              !!item.roles.length && (
                <div key={item.header}>
                  <div className={customStyles.groupHeader}>{item.header}</div>
                  <div className={styles.optionBody}>
                    {item.roles.map((option, i) => (
                      <RoleMenuOption
                        data={option}
                        key={i}
                        isSelected={!!(option.uid && !!selectedOptions.find((opt) => opt.uid === option.uid))}
                        onSelect={onSelect}
                        onClick={onMenuGroupClick}
                        hideDescription={item.hideDescription}
                      />
                    ))}
                  </div>
                </div>
              )
          )}
        </CustomScrollbar>
        <div className={customStyles.menuButtonRow}>
          <HorizontalGroup justify="flex-end">
            <Button size="sm" fill="text" onClick={onClearInternal}>
              Clear all
            </Button>
            <Button size="sm" onClick={onUpdateInternal}>
              Update
            </Button>
          </HorizontalGroup>
        </div>
      </div>
      {showSubMenu ? (
        <RolePickerSubMenu options={options} appliedRoles={appliedRoles} onClear={onClearInternal} />
      ) : (
        <div></div>
      )}
    </div>
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:');

const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');

interface RolePickerSubMenuProps {
  options: Role[];
  appliedRoles: Role[];
  onClear?: () => void;
}

export const RolePickerSubMenu = ({ options, appliedRoles, onClear }: RolePickerSubMenuProps): JSX.Element => {
  const customStyles = useStyles2(getStyles);
  const [selectedOptions, setSelectedOptions] = useState<Role[]>(appliedRoles);

  const onClearInternal = async () => {
    if (onClear) {
      onClear();
    }
    setSelectedOptions([]);
  };

  return (
    <div className={customStyles.subMenu} aria-label="Role picker submenu">
      <CustomScrollbar autoHide={false} autoHeightMax="250px" hideHorizontalTrack></CustomScrollbar>
      <div className={customStyles.subMenuButtonRow}>
        <HorizontalGroup justify="flex-end">
          <Button size="sm" fill="text" onClick={onClearInternal}>
            Clear all
          </Button>
        </HorizontalGroup>
      </div>
    </div>
  );
};

interface RoleMenuOptionProps<T> {
  data: Role;
  onSelect: (value: Role) => void;
  onClick?: (value: string) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  hideDescription?: boolean;
}

export const RoleMenuOption = React.forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps<any>>>(
  ({ data, isFocused, isSelected, disabled, onSelect, onClick, hideDescription }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);

    const wrapperClassName = cx(
      styles.option,
      isFocused && styles.optionFocused,
      disabled && customStyles.menuOptionDisabled
    );

    const onChange = (event: FormEvent<HTMLElement>) => {
      if (disabled) {
        return;
      }
      // event.preventDefault();
      // event.stopPropagation();
      onSelect(data);
    };

    const onClickInternal = (event: FormEvent<HTMLElement>) => {
      if (onClick) {
        onClick(data.name);
      }
    };

    return (
      <Tooltip content={data.description}>
        <div ref={ref} className={wrapperClassName} aria-label="Role picker option" onClick={onClickInternal}>
          <Checkbox
            value={isSelected}
            className={customStyles.menuOptionCheckbox}
            onChange={onChange}
            disabled={disabled}
          />
          <div className={styles.optionBody}>
            <span>{data.displayName || data.name}</span>
            {!hideDescription && data.description && <div className={styles.optionDescription}>{data.description}</div>}
          </div>
        </div>
      </Tooltip>
    );
  }
);

RoleMenuOption.displayName = 'RoleMenuOption';

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
      // overflow: hidden;
      // width: 50%;
      width: 300px;

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    subMenu: css`
      // overflow: hidden;
      width: 250px;
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
    menuOptionCheckbox: css`
      display: flex;
      margin: ${theme.spacing(0, 1, 0, 0.25)};
    `,
    menuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
    menuOptionDisabled: css`
      color: ${theme.colors.text.disabled};
      cursor: not-allowed;
    `,
    builtInRoleSelector: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    subMenuButtonRow: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
    `,
  };
};
