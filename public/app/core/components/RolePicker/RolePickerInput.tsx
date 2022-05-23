import { css, cx } from '@emotion/css';
import React, { FormEvent, HTMLProps, useEffect, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, getInputStyles, sharedInputStyle, styleMixins, Tooltip, Icon } from '@grafana/ui';

import { Role } from '../../../types';

import { ValueContainer } from './ValueContainer';
import { ROLE_PICKER_WIDTH } from './constants';

const stopPropagation = (event: React.MouseEvent<HTMLDivElement>) => event.stopPropagation();

interface InputProps extends HTMLProps<HTMLInputElement> {
  appliedRoles: Role[];
  builtInRole?: string;
  query: string;
  showBuiltInRole?: boolean;
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
  showBuiltInRole,
  onOpen,
  onClose,
  onQueryChange,
  ...rest
}: InputProps): JSX.Element => {
  const styles = useStyles2((theme) => getRolePickerInputStyles(theme, false, !!isFocused, !!disabled, false));
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isFocused) {
      inputRef.current?.focus();
    }
  });

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target?.value;
    onQueryChange(query);
  };

  const numberOfRoles = appliedRoles.length;

  return !isFocused ? (
    <div className={cx(styles.wrapper, styles.selectedRoles)} onMouseDown={onOpen}>
      {showBuiltInRole && <ValueContainer>{builtInRole}</ValueContainer>}
      <RolesLabel appliedRoles={appliedRoles} numberOfRoles={numberOfRoles} showBuiltInRole={showBuiltInRole} />
    </div>
  ) : (
    <div className={styles.wrapper}>
      {showBuiltInRole && <ValueContainer>{builtInRole}</ValueContainer>}
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

interface RolesLabelProps {
  appliedRoles: Role[];
  showBuiltInRole?: boolean;
  numberOfRoles: number;
}

export const RolesLabel = ({ showBuiltInRole, numberOfRoles, appliedRoles }: RolesLabelProps): JSX.Element => {
  const styles = useStyles2((theme) => getTooltipStyles(theme));

  return (
    <>
      {!!numberOfRoles ? (
        <Tooltip
          content={
            <div className={styles.tooltip}>
              {appliedRoles?.map((role) => (
                <p key={role.uid}>{role.displayName}</p>
              ))}
            </div>
          }
        >
          <ValueContainer>{`${showBuiltInRole ? '+' : ''}${numberOfRoles} role${
            numberOfRoles > 1 ? 's' : ''
          }`}</ValueContainer>
        </Tooltip>
      ) : (
        !showBuiltInRole && <ValueContainer>No roles assigned</ValueContainer>
      )}
    </>
  );
};

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
        width: ${ROLE_PICKER_WIDTH}px;
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

const getTooltipStyles = (theme: GrafanaTheme2) => ({
  tooltip: css`
    p {
      margin-bottom: ${theme.spacing(0.5)};
    }
  `,
});
