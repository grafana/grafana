import React, { FormEvent, useEffect, useState } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Checkbox, CustomScrollbar, HorizontalGroup, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';
import { Role } from 'app/types';

type RoleMap = { [key: string]: Role };
type BuiltInRoles = { [key: string]: Role[] };

interface RolePickerMenuProps {
  builtInRole: string;
  builtInRoles: BuiltInRoles;
  options: Role[];
  appliedRoles: string[];
  onUpdate: (newBuiltInRole: string, newRoles: string[]) => void;
  onClose: () => void;
  onClear?: () => void;
}

export const RolePickerMenu = ({
  builtInRole,
  options,
  appliedRoles,
  onUpdate,
  onClear,
}: RolePickerMenuProps): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const [selectedOptions, setSelectedOptions] = useState<RoleMap>({});
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState(builtInRole);

  useEffect(() => {
    const initialSelectedOptions: RoleMap = {};
    for (const option of options) {
      if (appliedRoles.includes(option.uid)) {
        initialSelectedOptions[option.uid] = option;
      }
    }
    setSelectedOptions(initialSelectedOptions);
  }, [appliedRoles, options]);

  const onSelect = (option: Role) => {
    if (selectedOptions[option.uid]) {
      const { [option.uid]: deselected, ...restOptions } = selectedOptions;
      setSelectedOptions(restOptions);
    } else {
      setSelectedOptions({ ...selectedOptions, [option.uid]: option });
    }
  };

  const onSelectedBuiltinRoleChange = (newRole: string) => {
    setSelectedBuiltInRole(newRole);
  };

  const onClearInternal = async () => {
    if (onClear) {
      onClear();
    }
    setSelectedOptions({});
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
    <div className={cx(styles.menu, customStyles.menu)} aria-label="Role picker menu">
      <CustomScrollbar autoHide={false} autoHeightMax="250px" hideHorizontalTrack>
        <div className={customStyles.groupHeader}>Built-in roles</div>
        <BuiltinRoleSelector value={builtInRole} onChange={onSelectedBuiltinRoleChange} />
        {!!customRoles?.length && (
          <>
            <div className={customStyles.groupHeader}>Custom roles</div>
            <div className={styles.optionBody}>
              {customRoles.map((option, i) => (
                <RoleMenuOption
                  data={option}
                  key={i}
                  isSelected={!!(option.uid && selectedOptions[option.uid])}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </>
        )}
        {!!fixedRoles?.length && (
          <>
            <div className={customStyles.groupHeader}>Fixed roles</div>
            <div className={styles.optionBody}>
              {fixedRoles.map((option, i) => (
                <RoleMenuOption
                  data={option}
                  key={i}
                  isSelected={!!(option.uid && selectedOptions[option.uid])}
                  onSelect={onSelect}
                  hideDescription
                />
              ))}
            </div>
          </>
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
  );
};

const filterCustomRoles = (option: Role) => !option.name?.startsWith('fixed:');

const filterFixedRoles = (option: Role) => option.name?.startsWith('fixed:');

interface RoleMenuOptionProps<T> {
  data: Role;
  onSelect: (value: Role) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  hideDescription?: boolean;
}

export const RoleMenuOption = React.forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps<any>>>(
  ({ data, isFocused, isSelected, disabled, onSelect, hideDescription }, ref) => {
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
      event.preventDefault();
      event.stopPropagation();
      onSelect(data);
    };

    return (
      <div ref={ref} className={wrapperClassName} aria-label="Role picker option" onClick={onChange}>
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
    );
  }
);

RoleMenuOption.displayName = 'RoleMenuOption';

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    menu: css`
      max-height: 650px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;

      & > div {
        padding-top: ${theme.spacing(1)};
      }
    `,
    groupHeader: css`
      padding: ${theme.spacing(0, 4)};
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
  };
};
