import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface RoleRadioButtonProps {
  name?: string;
  active: boolean;
  id: string;
  onChange: () => void;
}

export const RoleRadioButton: FC<RoleRadioButtonProps> = ({
  children,
  active = false,
  onChange,
  id,
  name = undefined,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.inlineContainer}>
      <div className={styles.radioButton}>
        <input type="radio" name="built-in_role_selector" id={id} value="Viewer" checked={active} onChange={onChange} />
        <label htmlFor={id} />
      </div>
      <label className={cx(styles.inlineLabel, 'inline-radio-label')} htmlFor={id}>
        {children}
      </label>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    radioButton: css`
      width: 18px;
      height: 18px;
      position: relative;

      // padding: 8px;

      input {
        opacity: 0;
        left: -100vw;
        z-index: -1000;
        position: absolute;

        &:disabled + label {
          background: ${theme.colors.action.disabledBackground};
          cursor: not-allowed;
        }

        &:checked + label {
          background: ${theme.colors.primary.main};
          border-color: ${theme.colors.primary.main};

          &::after {
            background: ${theme.colors.text.primary};
          }
        }
      }

      label {
        border: 1px solid ${theme.components.input.borderColor};

        position: absolute;
        display: block;
        content: '';
        width: 16px;
        height: 16px;
        border-radius: 8px;
        background: transparent;
        box-shadow: ${theme.shadows.z1};
        top: 50%;
        transform: translate3d(2px, -50%, 0);

        &:hover {
          border-color: ${theme.components.input.borderHover};
        }

        &::after {
          position: absolute;
          display: block;
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 3px;
          background: transparent;
          top: 50%;
          transform: translate3d(4.5px, -50%, 0);
          transition: transform 0.2s cubic-bezier(0.19, 1, 0.22, 1);
        }
      }
    `,
    inlineContainer: css`
      padding: ${theme.spacing(0, 1)};
      height: ${theme.spacing(theme.components.height.md)};
      display: inline-flex;
      align-items: center;
      background: ${theme.components.input.background};

      &:hover {
        .inline-radio-label {
          color: ${theme.colors.text.primary};
        }
      }
    `,
    inlineLabel: css`
      cursor: pointer;
      padding: ${theme.spacing(0, 1)};
      color: ${theme.colors.text.secondary};
      white-space: nowrap;
    `,
  };
};
