import React, { FormEvent, HTMLProps, MutableRefObject, useEffect, useRef } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2, getInputStyles, sharedInputStyle, styleMixins, Tooltip, Icon } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { ValueContainer } from './ValueContainer';
import { Role } from '../../../types';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

interface InputProps extends HTMLProps<HTMLInputElement> {
  appliedRoles: Role[];
  builtInRole: string;
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

  useEffect(() => {
    if (isFocused) {
      (inputRef as MutableRefObject<HTMLInputElement>).current?.focus();
    }
  });

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target?.value;
    onQueryChange(query);
  };

  const numberOfRoles = appliedRoles.length;

  return !isFocused ? (
    <div className={styles.selectedRoles} onMouseDown={onOpen}>
      <ValueContainer>{builtInRole}</ValueContainer>
      {!!numberOfRoles && (
        <Tooltip
          content={
            <div className={styles.tooltip}>
              {appliedRoles?.map((role) => (
                <p key={role.uid}>{role.displayName}</p>
              ))}
            </div>
          }
        >
          <div>
            <ValueContainer>{`+${numberOfRoles} role${numberOfRoles > 1 ? 's' : ''}`}</ValueContainer>
          </div>
        </Tooltip>
      )}
    </div>
  ) : (
    <div className={styles.wrapper}>
      <ValueContainer>{builtInRole}</ValueContainer>
      {appliedRoles.map((role) => (
        <ValueContainer key={role.uid}>{role.displayName}</ValueContainer>
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
        <Icon name="angle-up" className={styles.dropdownIndicator} onMouseDown={onClose} />
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
        min-width: 520px;
        min-height: 32px;
        height: auto;
        flex-direction: row;
        padding-right: 24px;
        max-width: 100%;
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        position: relative;
        box-sizing: border-box;
        cursor: default;
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
    suffix: styles.suffix,
    dropdownIndicator: css`
      cursor: pointer;
    `,
    selectedRoles: css`
      display: flex;
      align-items: center;
      cursor: ${disabled ? 'not-allowed' : 'pointer'};
    `,
    tooltip: css`
      p {
        margin-bottom: ${theme.spacing(0.5)};
      }
    `,
  };
};
