import React, { FormEvent, HTMLProps, MutableRefObject, useEffect, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, getInputStyles, sharedInputStyle, DropdownIndicator, styleMixins, Tooltip } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { ValueContainer } from './ValueContainer';
import { Role } from '../../../types';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

interface InputProps extends HTMLProps<HTMLInputElement> {
  appliedRoles: Role[];
  builtInRole: string;
  builtInRoles: Role[];
  query: string;
  isFocused?: boolean;
  disabled?: boolean;
  onQueryChange: (query?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  onClose: () => void;
}

export const RolePickerInput = ({
  appliedRoles,
  builtInRole,
  builtInRoles,
  disabled,
  isFocused,
  query,
  onOpen,
  onClose,
  onQueryChange,
  ...rest
}: InputProps): JSX.Element => {
  const styles = useStyles2((theme) => getRolePickerInputStyles(theme, false, !!isFocused, !!disabled, false));
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onInputClick = (event: FormEvent<HTMLElement>) => {
    if (isFocused) {
      onClose();
    } else {
      onOpen(event);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target?.value;
    onQueryChange(query);
  };

  const numberOfRoles = appliedRoles.length;

  useEffect(() => {
    if (isFocused) {
      (inputRef as MutableRefObject<HTMLInputElement>).current?.focus();
    }
  });

  return !isFocused ? (
    <div className={styles.selectedRoles} onMouseDown={onInputClick}>
      <Tooltip
        content={
          <>
            {builtInRoles.map((role) => (
              <p key={role.uid}>{role.displayName}</p>
            ))}
          </>
        }
      >
        <div>
          <ValueContainer iconName={'user'}>{builtInRole}</ValueContainer>
        </div>
      </Tooltip>
      {!!numberOfRoles && <ValueContainer>{`+${numberOfRoles} role${numberOfRoles > 1 ? 's' : ''}`}</ValueContainer>}
    </div>
  ) : (
    <div className={styles.wrapper} onMouseDown={onInputClick}>
      <Tooltip
        content={
          <>
            {builtInRoles.map((role) => (
              <p key={role.uid}>{role.displayName}</p>
            ))}
          </>
        }
      >
        <div>
          <ValueContainer iconName={'user'}>{builtInRole}</ValueContainer>
        </div>
      </Tooltip>
      {appliedRoles.map((role) => (
        <ValueContainer key={role.uid} iconName={'user'}>
          {role.displayName}
        </ValueContainer>
      ))}

      {!disabled && (
        <input
          {...rest}
          className={styles.input}
          ref={inputRef}
          onMouseDown={stopPropagation}
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
};

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
          ${styleMixins.focusCss(theme.v1)}
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
    selectedRoles: css`
      display: flex;
      align-items: center;
      cursor: pointer;
    `,
  };
};
