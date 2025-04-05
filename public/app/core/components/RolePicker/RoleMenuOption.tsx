import { cx } from '@emotion/css';
import { forwardRef, FormEvent } from 'react';

import { Checkbox, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { getSelectStyles } from '@grafana/ui/internal';
import { Role } from 'app/types';

import { t } from '../../internationalization';

import { getStyles } from './styles';

interface RoleMenuOptionProps {
  data: Role;
  onChange: (value: Role) => void;
  isSelected?: boolean;
  isFocused?: boolean;
  disabled?: boolean;
  mapped?: boolean;
  hideDescription?: boolean;
}

export const RoleMenuOption = forwardRef<HTMLDivElement, React.PropsWithChildren<RoleMenuOptionProps>>(
  ({ data, isFocused, isSelected, disabled, mapped, onChange, hideDescription }, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const customStyles = useStyles2(getStyles);
    disabled = disabled || mapped;
    let disabledMessage = '';
    if (disabled) {
      disabledMessage = 'You do not have permissions to assign this role.';
      if (mapped) {
        disabledMessage = 'Role assignment cannot be removed because the role is mapped through group sync.';
      }
    }

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
      // TODO: fix keyboard a11y
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div
        ref={ref}
        className={wrapperClassName}
        aria-label={t('role-picker.menu-option-aria-label', 'Role picker option')}
        onClick={onChangeInternal}
      >
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
        {disabledMessage && (
          <Tooltip content={disabledMessage}>
            <Icon name="lock" />
          </Tooltip>
        )}
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
