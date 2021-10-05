import React, { FC, useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { Checkbox, CustomScrollbar, Icon, IconName, useStyles2, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';
import { BuiltinRoleSelector } from './BuiltinRoleSelector';

// const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

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

  const [selectedOptions, setSelectedOptions] = useState({} as any);

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

  return (
    <div className={cx(styles.menu, customStyles.menu)} aria-label="Role picker menu">
      <div className={customStyles.groupHeader}>Built-in roles</div>
      <BuiltinRoleSelector value={builtInRole} onChange={onBuiltinRoleChange} />
      <div className={styles.optionBody}></div>
      <div className={customStyles.groupHeader}>Custom roles</div>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        <div className={styles.optionBody}>
          {options.map((option, i) => (
            <SelectMenuOptions
              data={option}
              key={i}
              isSelected={option.value && selectedOptions[option.value]}
              onSelect={onSelect}
            />
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
        className={cx(styles.option, isFocused && styles.optionFocused, isSelected && styles.optionSelected)}
        // {...innerProps}
        aria-label="Select option"
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

export const getStyles = (theme: GrafanaTheme2, isReversed = false) => {
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
  };
};
