import { cx } from '@emotion/css';
import { FormEvent, memo } from 'react';
import * as React from 'react';

import { t } from '@grafana/i18n';
import { Checkbox, Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';

import { getStyles } from './styles';

interface RoleMenuGroupsOptionProps {
  // display name
  name: string;
  // group id
  value: string;
  onChange: (value: string) => void;
  onClick?: (value: string) => void;
  onOpenSubMenu?: (value: string) => void;
  onCloseSubMenu?: () => void;
  isSelected?: boolean;
  partiallySelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  root?: HTMLElement;
}

export const RoleMenuGroupOption = memo(
  React.forwardRef<HTMLDivElement, RoleMenuGroupsOptionProps>(
    (
      {
        name,
        value,
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
        if (value) {
          onChange(value);
        }
      };

      const onClickInternal = (event: FormEvent<HTMLElement>) => {
        if (onClick) {
          onClick(value!);
        }
      };

      const onMouseEnter = () => {
        if (onOpenSubMenu) {
          onOpenSubMenu(value!);
        }
      };

      const onMouseLeave = () => {
        if (onCloseSubMenu) {
          onCloseSubMenu();
        }
      };

      return (
        <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
          {/* TODO: fix keyboard a11y */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={ref}
            className={wrapperClassName}
            aria-label={t('role-picker.menu-group-option-aria-label', 'Role picker option')}
            onClick={onClickInternal}
          >
            <Checkbox
              value={isSelected}
              className={cx(customStyles.menuOptionCheckbox, {
                [customStyles.checkboxPartiallyChecked]: partiallySelected,
              })}
              onChange={onChangeInternal}
              disabled={disabled}
            />
            <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
              <span>{name}</span>
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
  )
);

RoleMenuGroupOption.displayName = 'RoleMenuGroupOption';
