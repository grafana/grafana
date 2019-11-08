import React, { cloneElement, FC, HTMLProps, isValidElement, ReactNode } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';
import { Spinner } from '../..';
import { getFocusStyle } from '../commonStyles';
import { selectThemeVariant, stylesFactory, useTheme } from '../../../themes';

export interface Props extends HTMLProps<HTMLInputElement> {
  /** Show an invalid state around the input */
  invalid?: boolean;
  /** Show an icon as a prefix in the input */
  icon?: string;
  /** Show a loading indicator as a suffix in the input */
  loading?: boolean;
  /** Add a component as an addon before the input  */
  addonBefore?: ReactNode;
  /** Add a component as an addon after the input */
  addonAfter?: ReactNode;
}

const getInputStyle = stylesFactory(
  (
    theme: GrafanaTheme,
    invalid = false,
    disabled = false,
    prefix = false,
    suffix = false,
    addonBefore = false,
    addonAfter = false
  ) => {
    const colors = theme.colors;
    const backgroundColor = selectThemeVariant({ light: colors.white, dark: colors.gray15 }, theme.type);
    const borderColor = selectThemeVariant({ light: colors.gray4, dark: colors.gray25 }, theme.type);
    const inputBorderColor = invalid ? colors.redBase : borderColor;
    const borderRadius = theme.border.radius.sm;
    const height = theme.spacing.formInputHeight;
    const disabledBackground = selectThemeVariant({ light: colors.gray6, dark: colors.gray10 }, theme.type);
    const disabledColor = selectThemeVariant({ light: colors.gray33, dark: colors.gray70 }, theme.type);
    const inputBorders = cx(
      css`
        border: 1px solid ${inputBorderColor};
        border-radius: ${borderRadius};
      `,
      prefix &&
        css`
          border-left: none;
        `,
      (prefix || (!prefix && addonBefore)) &&
        css`
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        `,
      suffix &&
        css`
          border-right: none;
        `,
      (suffix || (!suffix && addonAfter)) &&
        css`
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        `
    );

    const prefixSuffix = css`
      background-color: ${disabled ? disabledBackground : backgroundColor};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-grow: 0;
      flex-shrink: 0;
      width: 24px;
      z-index: 0;
      border: 1px solid ${inputBorderColor};
    `;

    return {
      inputWrapper: cx(
        css`
          width: 100%;
          display: flex;
          height: ${height};
          border-radius: ${borderRadius};
        `,
        getFocusStyle(theme)
      ),
      prefix: cx(
        prefixSuffix,
        css`
          border-right: none;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
          border-top-left-radius: ${addonBefore ? 0 : borderRadius};
          border-bottom-left-radius: ${addonBefore ? 0 : borderRadius};
        `
      ),
      input: cx(
        css`
          background-color: ${backgroundColor};
          height: 100%;
          width: 100%;
          flex-grow: 1;
          padding: 0 ${suffix ? theme.spacing.xs : theme.spacing.sm} 0 ${prefix ? theme.spacing.xs : theme.spacing.sm};
          margin-bottom: ${invalid ? theme.spacing.formSpacingBase / 2 : theme.spacing.formSpacingBase * 2}px;
          position: relative;
          z-index: 1;

          line-height: ${theme.typography.lineHeight.lg};
          font-size: ${theme.typography.size.md};
          color: ${selectThemeVariant({ light: colors.gray25, dark: colors.gray85 }, theme.type)};

          &:hover {
            border-color: ${invalid
              ? colors.redBase
              : selectThemeVariant({ light: colors.gray70, dark: colors.gray33 }, theme.type)};
          }

          &:focus {
            outline: none;
          }

          &:disabled {
            background-color: ${disabledBackground};
            color: ${disabledColor};
          }
        `,
        inputBorders
      ),
      addon: css`
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: ${backgroundColor};
        flex-grow: 0;
        flex-shrink: 0;
        z-index: 0;
        position: relative;
        border: 1px solid ${borderColor};
        border-radius: ${borderRadius};

        &:first-child {
          border-right: none;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }

        &:last-child {
          border-left: none;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `,
      addonElement: css`
        label: addon-override;
        border: 0;
        width: 100%;
        height: 100%;

        &:focus {
          box-shadow: none;
        }
      `,
      suffix: cx(
        prefixSuffix,
        css`
          border-left: none;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          border-top-right-radius: ${addonAfter ? 0 : borderRadius};
          border-bottom-right-radius: ${addonAfter ? 0 : borderRadius};
        `
      ),
    };
  }
);

export const Input: FC<Props> = props => {
  const { addonAfter, addonBefore, icon, invalid, loading, ...restProps } = props;

  const theme = useTheme();
  const styles = getInputStyle(theme, invalid, restProps.disabled, !!icon, !!loading, !!addonBefore, !!addonAfter);

  return (
    <div className={styles.inputWrapper} tabIndex={0}>
      {!!addonBefore && (
        <div className={styles.addon}>
          {isValidElement(addonBefore) &&
            cloneElement(addonBefore, {
              className: styles.addonElement,
            })}
        </div>
      )}
      {icon && (
        <div className={styles.prefix}>
          <i className={icon} />
        </div>
      )}
      <input className={styles.input} {...restProps} />
      {loading && (
        <div className={styles.suffix}>
          <Spinner />
        </div>
      )}
      {!!addonAfter && (
        <div className={styles.addon}>
          {isValidElement(addonAfter) &&
            cloneElement(addonAfter, {
              className: styles.addonElement,
            })}
        </div>
      )}
    </div>
  );
};
