import { cx } from '@emotion/css';
import React, { FormEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import { Checkbox, Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/src/components/Select/getSelectStyles';

import { getStyles } from './styles';

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
