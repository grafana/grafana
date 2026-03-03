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
  onToggleSubMenu?: (value: string) => void;
  isSelected?: boolean;
  partiallySelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  root?: HTMLElement;
  /** Label showing inherited role count, e.g. "(2 via Viewer)" */
  inheritedLabel?: string;
  /** True when ALL roles in this group are inherited (checkbox is informational only) */
  allInherited?: boolean;
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
        onToggleSubMenu,
        children,
        root,
        inheritedLabel,
        allInherited,
      },
      ref
    ) => {
      const theme = useTheme2();
      const styles = getSelectStyles(theme);
      const customStyles = useStyles2(getStyles);

      const wrapperClassName = cx(
        styles.option,
        isFocused && styles.optionFocused,
        disabled && customStyles.menuOptionDisabled,
        allInherited && customStyles.menuOptionInherited
      );

      const onChangeInternal = (event: FormEvent<HTMLElement>) => {
        // Stop propagation so the row click handler doesn't also fire
        event.stopPropagation();
        if (disabled) {
          return;
        }
        if (value) {
          onChange(value);
        }
      };

      const onRowClick = () => {
        if (onToggleSubMenu) {
          onToggleSubMenu(value);
        }
      };

      return (
        <div>
          {/* TODO: fix keyboard a11y */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div
            ref={ref}
            className={wrapperClassName}
            aria-label={t('role-picker.menu-group-option-aria-label', 'Role picker option')}
            onClick={onRowClick}
          >
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                value={isSelected}
                className={cx(customStyles.menuOptionCheckbox, {
                  [customStyles.checkboxPartiallyChecked]: partiallySelected,
                })}
                onChange={onChangeInternal}
                disabled={disabled}
              />
            </div>
            <div className={cx(styles.optionBody, customStyles.menuOptionBody)}>
              <span>{name}</span>
              {inheritedLabel && (
                <span className={customStyles.inheritedBadge}>{inheritedLabel}</span>
              )}
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
