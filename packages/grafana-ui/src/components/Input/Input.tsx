import { css, cx } from '@emotion/css';
import React, { HTMLProps, ReactNode } from 'react';
import useMeasure from 'react-use/lib/useMeasure';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory, useTheme2 } from '../../themes';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';
import { Spinner } from '../Spinner/Spinner';

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
  /** Overrides the styling of a focused input */
  focusStyles?: (theme: GrafanaTheme2) => string;
}

interface StyleDeps {
  theme: GrafanaTheme2;
  invalid?: boolean;
  width?: number;
  focusStyles?: (theme: GrafanaTheme2) => string;
}

export const Input = React.forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    className,
    addonAfter,
    addonBefore,
    prefix,
    suffix,
    invalid,
    loading,
    width = 0,
    focusStyles,
    ...restProps
  } = props;
  /**
   * Prefix & suffix are positioned absolutely within inputWrapper. We use client rects below to apply correct padding to the input
   * when prefix/suffix is larger than default (28px = 16px(icon) + 12px(left/right paddings)).
   * Thanks to that prefix/suffix do not overflow the input element itself.
   */
  const [prefixRef, prefixRect] = useMeasure<HTMLDivElement>();
  const [suffixRef, suffixRect] = useMeasure<HTMLDivElement>();

  const theme = useTheme2();
  const styles = getInputStyles({ theme, invalid: !!invalid, width, focusStyles });

  return (
    <div className={cx(styles.wrapper, className)} data-testid={'input-wrapper'}>
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
            paddingLeft: prefix ? prefixRect.width + 12 : undefined,
            paddingRight: suffix || loading ? suffixRect.width + 12 : undefined,
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

export const getInputStyles = stylesFactory(({ theme, invalid = false, width, focusStyles }: StyleDeps) => {
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
    color: ${theme.colors.text.secondary};
  `;

  return {
    // Wraps inputWrapper and addons
    wrapper: cx(
      css`
        label: input-wrapper;
        display: flex;
        width: ${width ? `${theme.spacing(width)}` : '100%'};
        height: ${theme.spacing(theme.components.height.md)};
        border-radius: ${theme.shape.borderRadius()};
        &:hover {
          > .prefix,
          .suffix,
          .input {
            border-color: ${invalid ? theme.colors.error.border : theme.colors.primary.border};
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
      focusStyles ? focusStyles(theme) : getFocusStyle(theme),
      sharedInputStyle(theme, invalid),
      css`
        label: input-input;
        position: relative;
        z-index: 0;
        flex-grow: 1;
        border-radius: ${theme.shape.borderRadius()};
        height: 100%;
        width: 100%;
      `
    ),
    inputDisabled: css`
      background-color: ${theme.colors.action.disabledBackground};
      color: ${theme.colors.action.disabledText};
      border: 1px solid ${theme.colors.action.disabledBackground};
      &:focus {
        box-shadow: none;
      }
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
        padding-left: ${theme.spacing(1)};
        padding-right: ${theme.spacing(0.5)};
        border-right: none;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      `
    ),
    suffix: cx(
      prefixSuffix,
      css`
        label: input-suffix;
        padding-left: ${theme.spacing(1)};
        padding-right: ${theme.spacing(1)};
        margin-bottom: -2px;
        border-left: none;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        right: 0;
      `
    ),
    loadingIndicator: css`
      & + * {
        margin-left: ${theme.spacing(0.5)};
      }
    `,
  };
});
