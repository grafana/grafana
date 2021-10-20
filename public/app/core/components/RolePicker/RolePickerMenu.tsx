import React, { FC, useEffect, useState } from 'react';
import { css, cx } from '@emotion/css';
import { Button, Checkbox, CustomScrollbar, HorizontalGroup, Icon, IconName, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';

interface RolePickerMenuProps {
  builtInRole: string;
  options: Array<SelectableValue<string>>;
  appliedRoles: { [key: string]: boolean };
  onUpdate: (newBuiltInRole: string, newRoles: string[]) => void;
  onClose: () => void;
  onClear?: () => void;
}

export const RolePickerMenu = (props: RolePickerMenuProps): JSX.Element => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const customStyles = useStyles2(getStyles);
  const { builtInRole, options, appliedRoles, onUpdate, onClear } = props;

  const [selectedOptions, setSelectedOptions] = useState<SelectableValue>({});
  const [selectedBuiltInRole, setSelectedBuiltInRole] = useState(builtInRole);

  useEffect(() => {
    const initialSelectedOptions: SelectableValue = {};
    for (const option of options) {
      if (option.value && appliedRoles[option.value]) {
        initialSelectedOptions[option.value] = option;
      }
    }
    setSelectedOptions(initialSelectedOptions);
  }, [appliedRoles, options]);

  const onSelect = (option: SelectableValue<string>) => {
    if (option.value) {
      if (selectedOptions[option.value]) {
        const { [option.value]: deselected, ...restOptions } = selectedOptions;
        setSelectedOptions(restOptions);
      } else {
        setSelectedOptions({ ...selectedOptions, [option.value]: option });
      }
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
      const roleUID = selectedOptions[key]?.value;
      selectedCustomRoles.push(roleUID);
    }
    onUpdate(selectedBuiltInRole, selectedCustomRoles);
  };

  return (
    <div className={cx(styles.menu, customStyles.menu)} aria-label="Role picker menu">
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <BuiltinRoleSelector value={builtInRole} onChange={onSelectedBuiltinRoleChange} />
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <SelectMenuOptions
              data={option}
              key={i}
              isSelected={!!(option.value && selectedOptions[option.value])}
              onSelect={onSelect}
            />
          ))}
        </div>
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

interface SelectMenuOptionProps<T> {
  isSelected: boolean;
  isFocused?: boolean;
  data: SelectableValue<T>;
  onSelect: (value: SelectableValue<T>) => void;
}

export const SelectMenuOptions = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuOptionProps<any>>>(
  (props, ref) => {
    const { data, isFocused, isSelected, onSelect } = props;

    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);

    return (
      <div
        ref={ref}
        className={cx(styles.option, isFocused && styles.optionFocused)}
        aria-label="Role picker option"
        onClick={() => onSelect(data)}
      >
        <Checkbox value={isSelected} className={customStyles.menuOptionCheckbox} />
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

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    menu: css`
      max-height: 400px;
      position: absolute;
      z-index: ${theme.zIndex.dropdown};
      overflow: hidden;
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
  };
};
