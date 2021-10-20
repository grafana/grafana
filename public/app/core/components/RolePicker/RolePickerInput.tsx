import React, { FormEvent } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, stylesFactory, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { getInputStyles } from '@grafana/ui/src/components/Input/Input';
import { sharedInputStyle } from '@grafana/ui/src/components/Forms/commonStyles';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { DropdownIndicator } from '@grafana/ui/src/components/Select/DropdownIndicator';

interface InputProps {
  role?: string;
  query: string;
  numberOfRoles?: number;
  isFocused?: boolean;
  disabled?: boolean;
  onQueryChange: (query?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  onClose: () => void;
}

export const RolePickerInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { role, disabled, isFocused, query, numberOfRoles, onOpen, onClose, onQueryChange } = props;

  const theme = useTheme2();
  const styles = getRolePickerInputStyles(theme, false, !!isFocused, !!disabled, false);

  const onInputClick = (event: FormEvent<HTMLElement>) => {
    if (!!isFocused) {
      event.preventDefault();
      event.stopPropagation();
      (ref as any).current.blur();
      onClose();
    } else {
      (ref as any).current.focus();
      onOpen(event);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target?.value;
    onQueryChange(query);
  };

  return (
    <div className={styles.wrapper} onMouseDown={onInputClick}>
      <div className={styles.builtInRoleValueContainer}>
        <Icon name="user" size="xs" />
        {role}
      </div>
      {!!numberOfRoles && (
        <div className={styles.builtInRoleValueContainer}>
          <Icon name="user" size="xs" />
          {`+${numberOfRoles} role${numberOfRoles > 1 ? 's' : ''}`}
        </div>
      )}
      {!disabled && (
        <input
          className={styles.input}
          ref={ref}
          onMouseDown={onInputClick}
          onChange={onInputChange}
          data-testid="role-picker-input"
          placeholder={isFocused ? 'Select role' : ''}
          value={query}
        />
      )}
      <div className={styles.suffix}>
        <DropdownIndicator isOpen={!!isFocused} />
      </div>
    </div>
  );
});

RolePickerInput.displayName = 'RolePickerInput';

const getRolePickerInputStyles = stylesFactory(
  (theme: GrafanaTheme2, invalid: boolean, focused: boolean, disabled: boolean, withPrefix: boolean) => {
    const styles = getInputStyles({ theme, invalid });

    return {
      wrapper: cx(
        styles.wrapper,
        sharedInputStyle(theme, invalid),
        focused &&
          css`
            ${focusCss(theme.v1)}
          `,
        disabled && styles.inputDisabled,
        css`
          min-height: 32px;
          height: auto;
          flex-direction: row;
          padding-right: 0;
          max-width: 100%;
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          position: relative;
          box-sizing: border-box;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        `,
        withPrefix &&
          css`
            padding-left: 0;
          `
      ),
      input: cx(
        sharedInputStyle(theme, invalid),
        css`
          max-width: 120px;
          border: none;
          cursor: ${focused ? 'default' : 'pointer'};
        `
      ),
      builtInRoleValueContainer: cx(
        styles.prefix,
        css`
          position: relative;
          display: flex;
          align-items: center;
          line-height: 1;
          background: ${disabled
            ? theme.colors.emphasize(theme.colors.background.secondary)
            : theme.colors.background.secondary};
          border-radius: ${theme.shape.borderRadius()};
          margin: ${theme.spacing(0.25, 1, 0.25, 0)};
          padding: ${theme.spacing(0.25, 1, 0.25, 0.25)};
          color: ${theme.colors.text.primary};
          font-size: ${theme.typography.bodySmall.fontSize};

          &:hover {
            background: ${theme.colors.emphasize(theme.colors.background.secondary)};
          }

          svg {
            margin: ${theme.spacing(0, 0.25, 0, 0)};
          }
        `
      ),
      suffix: cx(styles.suffix),
    };
  }
);
