import React, { FormEvent, HTMLProps, MutableRefObject } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, getInputStyles, sharedInputStyle, DropdownIndicator, focusCss } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { ValueContainer } from './ValueContainer';

interface InputProps extends HTMLProps<HTMLInputElement> {
  role?: string;
  query: string;
  numberOfRoles?: number;
  isFocused?: boolean;
  disabled?: boolean;
  onQueryChange: (query?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  onClose: () => void;
}

export const RolePickerInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ role, disabled, isFocused, query, numberOfRoles, onOpen, onClose, onQueryChange, ...rest }, ref) => {
    const styles = useStyles2((theme) => getRolePickerInputStyles(theme, false, !!isFocused, !!disabled, false));

    const onInputClick = (event: FormEvent<HTMLElement>) => {
      if (isFocused) {
        event.preventDefault();
        event.stopPropagation();
        (ref as MutableRefObject<HTMLInputElement>).current.blur();
        onClose();
      } else {
        (ref as MutableRefObject<HTMLInputElement>).current.focus();
        onOpen(event);
      }
    };

    const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target?.value;
      onQueryChange(query);
    };

    return (
      <div className={styles.wrapper} onMouseDown={onInputClick}>
        <ValueContainer iconName={'user'}>{role}</ValueContainer>
        {!!numberOfRoles && <ValueContainer>{`+${numberOfRoles} role${numberOfRoles > 1 ? 's' : ''}`}</ValueContainer>}
        {!disabled && (
          <input
            {...rest}
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
  }
);

RolePickerInput.displayName = 'RolePickerInput';

const getRolePickerInputStyles = (
  theme: GrafanaTheme2,
  invalid: boolean,
  focused: boolean,
  disabled: boolean,
  withPrefix: boolean
) => {
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
    suffix: cx(styles.suffix),
  };
};
