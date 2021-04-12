import React, { HTMLProps, ReactNode } from 'react';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';
import { stylesFactory, useTheme } from '../../themes';
import { Spinner } from '../Spinner/Spinner';
import { useClientRect } from '../../utils/useClientRect';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'prefix' | 'size'> {
  /** Sets the width to a multiple of 8px. Should only be used with inline forms. Setting width of the container is preferred in other cases.*/
  width?: number;
  /** Show an invalid state around the input */
  invalid?: boolean;
  /** Show an icon as a prefix in the input */
  prefix?: ReactNode;
  /** Show an icon as a suffix in the input */
  suffix?: ReactNode;
  /** Show a loading indicator as a suffix in the input */
  loading?: boolean;
  /** Add a component as an addon before the input  */
  addonBefore?: ReactNode;
  /** Add a component as an addon after the input */
  addonAfter?: ReactNode;
}

interface StyleDeps {
  theme: GrafanaTheme;
  invalid: boolean;
  width?: number;
}

export const getInputStyles = stylesFactory(({ theme, invalid = false, width }: StyleDeps) => {
  const prefixSuffixStaticWidth = '28px';
  const prefixSuffix = css`
    position: absolute;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-grow: 0;
    flex-shrink: 0;
    font-size: ${theme.typography.size.md};
    height: 100%;
    /* Min width specified for prefix/suffix classes used outside React component*/
    min-width: ${prefixSuffixStaticWidth};
    color: ${theme.v2.palette.text.secondary};
  `;

  return {
    // Wraps inputWrapper and addons
    wrapper: cx(
      css`
        label: input-wrapper;
        display: flex;
        width: ${width ? `${theme.v2.spacing(width)}` : '100%'};
        height: ${theme.v2.spacing(theme.v2.components.height.md)};
        border-radius: ${theme.v2.shape.borderRadius()};
        &:hover {
          > .prefix,
          .suffix,
          .input {
            border-color: ${invalid ? theme.v2.palette.error.border : theme.v2.palette.primary.border};
          }

          // only show number buttons on hover
          input[type='number'] {
            -moz-appearance: number-input;
            -webkit-appearance: number-input;
            appearance: textfield;
          }

          input[type='number']::-webkit-inner-spin-button,
          input[type='number']::-webkit-outer-spin-button {
            -webkit-appearance: inner-spin-button !important;
            opacity: 1;
          }
        }
      `
    ),
    // Wraps input and prefix/suffix
    inputWrapper: css`
      label: input-inputWrapper;
      position: relative;
      flex-grow: 1;
      /* we want input to be above addons, especially for focused state */
      z-index: 1;

      /* when input rendered with addon before only*/
      &:not(:first-child):last-child {
        > input {
          border-left: none;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      }

      /* when input rendered with addon after only*/
      &:first-child:not(:last-child) {
        > input {
          border-right: none;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
      }

      /* when rendered with addon before and after */
      &:not(:first-child):not(:last-child) {
        > input {
          border-right: none;
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      }

      input {
        /* paddings specified for classes used outside React component */
        &:not(:first-child) {
          padding-left: ${prefixSuffixStaticWidth};
        }
        &:not(:last-child) {
          padding-right: ${prefixSuffixStaticWidth};
        }
        &[readonly] {
          cursor: default;
        }
      }
    `,

    input: cx(
      getFocusStyle(theme),
      sharedInputStyle(theme, invalid),
      css`
        label: input-input;
        position: relative;
        z-index: 0;
        flex-grow: 1;
        border-radius: ${theme.v2.shape.borderRadius()};
        height: 100%;
        width: 100%;
      `
    ),
    inputDisabled: css`
      background-color: ${theme.v2.palette.action.disabledBackground};
      color: ${theme.v2.palette.action.disabledText};
    `,
    addon: css`
      label: input-addon;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-grow: 0;
      flex-shrink: 0;
      position: relative;

      &:first-child {
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        > :last-child {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
      }

      &:last-child {
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        > :first-child {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      }
      > *:focus {
        /* we want anything that has focus and is an addon to be above input */
        z-index: 2;
      }
    `,
    prefix: cx(
      prefixSuffix,
      css`
        label: input-prefix;
        padding-left: ${theme.v2.spacing(1)};
        padding-right: ${theme.v2.spacing(0.5)};
        border-right: none;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      `
    ),
    suffix: cx(
      prefixSuffix,
      css`
        label: input-suffix;
        padding-left: ${theme.v2.spacing(1)};
        padding-right: ${theme.v2.spacing(0.5)};
        margin-bottom: -2px;
        border-left: none;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        right: 0;
      `
    ),
    loadingIndicator: css`
      & + * {
        margin-left: ${theme.v2.spacing(0.5)};
      }
    `,
  };
});

export const Input = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const { className, addonAfter, addonBefore, prefix, suffix, invalid, loading, width = 0, ...restProps } = props;
  /**
   * Prefix & suffix are positioned absolutely within inputWrapper. We use client rects below to apply correct padding to the input
   * when prefix/suffix is larger than default (28px = 16px(icon) + 12px(left/right paddings)).
   * Thanks to that prefix/suffix do not overflow the input element itself.
   */
  const [prefixRect, prefixRef] = useClientRect<HTMLDivElement>();
  const [suffixRect, suffixRef] = useClientRect<HTMLDivElement>();

  const theme = useTheme();
  const styles = getInputStyles({ theme, invalid: !!invalid, width });

  return (
    <div className={cx(styles.wrapper, className)}>
      {!!addonBefore && <div className={styles.addon}>{addonBefore}</div>}

      <div className={styles.inputWrapper}>
        {prefix && (
          <div className={styles.prefix} ref={prefixRef}>
            {prefix}
          </div>
        )}

        <input
          ref={ref}
          className={styles.input}
          {...restProps}
          style={{
            paddingLeft: prefixRect ? prefixRect.width : undefined,
            paddingRight: suffixRect ? suffixRect.width : undefined,
          }}
        />

        {(suffix || loading) && (
          <div className={styles.suffix} ref={suffixRef}>
            {loading && <Spinner className={styles.loadingIndicator} inline={true} />}
            {suffix}
          </div>
        )}
      </div>

      {!!addonAfter && <div className={styles.addon}>{addonAfter}</div>}
    </div>
  );
});

Input.displayName = 'Input';
