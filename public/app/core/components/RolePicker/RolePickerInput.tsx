import React, { FormEvent, useCallback, useState } from 'react';
import { css, cx } from '@emotion/css';
import { Icon, stylesFactory, useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { getInputStyles } from '@grafana/ui/src/components/Input/Input';
import { sharedInputStyle } from '@grafana/ui/src/components/Forms/commonStyles';
import { focusCss } from '@grafana/ui/src/themes/mixins';
import { DropdownIndicator } from '@grafana/ui/src/components/Select/DropdownIndicator';

interface InputProps {
  role?: string;
  onChange: (role?: string) => void;
  onOpen: (event: FormEvent<HTMLElement>) => void;
  disabled?: boolean;
}

export const RolePickerInput = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const { role, disabled, onChange, onOpen } = props;
  const [focused, setFocused] = useState(false);
  const [internalRole] = useState(() => {
    return role;
  });

  const theme = useTheme2();
  const styles = getRolePickerInputStyles(theme, false, focused, !!disabled, false);

  const onFocus = useCallback(
    (event: FormEvent<HTMLElement>) => {
      event.stopPropagation();
      setFocused(true);
      (ref as any).current.focus();
      onOpen(event);
    },
    [ref, onOpen]
  );

  const onBlur = useCallback(() => {
    setFocused(false);
    onChange(internalRole);
  }, [internalRole, onChange]);

  return (
    <div className={styles.wrapper} onFocus={onFocus} onClick={onFocus}>
      <div className={styles.builtInRoleValueContainer}>
        <Icon name="user" size="xs" />
        {internalRole}
      </div>
      <input
        className={styles.input}
        ref={ref}
        // onClick={stopPropagation}
        // onFocus={onFocus}
        onBlur={onBlur}
        // onChange={onChangeDate}
        // value={internalRole}
        data-testid="date-time-input"
        placeholder="Select role"
      />
      <div className={styles.suffix}>
        <DropdownIndicator isOpen={focused} />
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
          cursor: default;
          display: flex;
          flex-wrap: wrap;
          // justify-content: space-between;
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
          border: none;
        `
      ),
      builtInRoleValueContainer: cx(
        styles.prefix,
        css`
          position: relative;
          // label: grafana-select-multi-value-container;
          display: flex;
          align-items: center;
          line-height: 1;
          background: ${theme.colors.background.secondary};
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
