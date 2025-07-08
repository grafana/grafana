import { css, cx } from '@emotion/css';
import { forwardRef, HTMLProps, ReactNode, useContext } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { getFocusStyle, sharedInputStyle } from '../Forms/commonStyles';
import { Spinner } from '../Spinner/Spinner';

import { AutoSizeInputContext } from './AutoSizeInputContext';

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
  theme: GrafanaTheme2;
  invalid?: boolean;
  width?: number;
}

export const Input = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const {
    className,
    addonAfter,
    addonBefore,
    prefix,
    suffix: suffixProp,
    invalid,
    loading,
    width = 0,
    ...restProps
  } = props;
  /**
   * Prefix & suffix are positioned absolutely within inputWrapper. We use client rects below to apply correct padding to the input
   * when prefix/suffix is larger than default (28px = 16px(icon) + 12px(left/right paddings)).
   * Thanks to that prefix/suffix do not overflow the input element itself.
   */
  const [prefixRef, prefixRect] = useMeasure<HTMLDivElement>();
  const [suffixRef, suffixRect] = useMeasure<HTMLDivElement>();

  // Yes, this is gross - When Input is being wrapped by AutoSizeInput, add the suffix/prefix width to the overall width
  // so the text content is not clipped. The intention is to make all the input's text appear without overflow/clipping,
  // which isn't normally how width is used in this component.
  // This behaviour is not controlled via a prop so we can limit API surface, and remove this as a 'breaking change' later
  // if a better solution is found.
  const isInAutoSizeInput = useContext(AutoSizeInputContext);
  const accessoriesWidth = (prefixRect.width || 0) + (suffixRect.width || 0);
  const autoSizeWidth = isInAutoSizeInput && width ? width + accessoriesWidth / 8 : undefined;

  const theme = useTheme2();

  // Don't pass the width prop, as this causes an unnecessary amount of Emotion calls when auto sizing
  const styles = getInputStyles({ theme, invalid: !!invalid, width: autoSizeWidth ? undefined : width });

  const suffix = suffixProp || (loading && <Spinner inline={true} />);

  return (
    <div
      className={cx(styles.wrapper, className)}
      // If the component is in an AutoSizeInput, set the width here to prevent emotion doing stuff
      // on every keypress
      style={autoSizeWidth ? { width: theme.spacing(autoSizeWidth) } : undefined}
      data-testid="input-wrapper"
    >
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

        {suffix && (
          <div className={styles.suffix} ref={suffixRef}>
            {suffix}
          </div>
        )}
      </div>
      {!!addonAfter && <div className={styles.addon}>{addonAfter}</div>}
    </div>
  );
});

Input.displayName = 'Input';

export const getInputStyles = stylesFactory(({ theme, invalid = false, width }: StyleDeps) => {
  const prefixSuffixStaticWidth = '28px';
  const prefixSuffix = css({
    position: 'absolute',
    top: 0,
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    fontSize: theme.typography.size.md,
    height: '100%',
    /* Min width specified for prefix/suffix classes used outside React component*/
    minWidth: prefixSuffixStaticWidth,
    color: theme.colors.text.secondary,
  });

  return {
    // Wraps inputWrapper and addons
    wrapper: cx(
      css({
        label: 'input-wrapper',
        display: 'flex',
        width: width ? theme.spacing(width) : '100%',
        height: theme.spacing(theme.components.height.md),
        borderRadius: theme.shape.radius.default,
        '&:hover': {
          '> .prefix, .suffix, .input': {
            borderColor: invalid ? theme.colors.error.border : theme.colors.primary.border,
          },

          // only show number buttons on hover
          "input[type='number']": {
            appearance: 'textfield',
          },

          "input[type='number']::-webkit-inner-spin-button, input[type='number']::-webkit-outer-spin-button": {
            // Need type assertion here due to the use of !important
            // see https://github.com/frenic/csstype/issues/114#issuecomment-697201978
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            WebkitAppearance: 'inner-spin-button !important' as 'inner-spin-button',
            opacity: 1,
          },
        },
      })
    ),
    // Wraps input and prefix/suffix
    inputWrapper: css({
      label: 'input-inputWrapper',
      position: 'relative',
      flexGrow: 1,
      /* we want input to be above addons, especially for focused state */
      zIndex: 1,

      /* when input rendered with addon before only*/
      '&:not(:first-child):last-child': {
        '> input': {
          borderLeft: 'none',
          borderTopLeftRadius: 'unset',
          borderBottomLeftRadius: 'unset',
        },
      },

      /* when input rendered with addon after only*/
      '&:first-child:not(:last-child)': {
        '> input': {
          borderRight: 'none',
          borderTopRightRadius: 'unset',
          borderBottomRightRadius: 'unset',
        },
      },

      /* when rendered with addon before and after */
      '&:not(:first-child):not(:last-child)': {
        '> input': {
          borderRight: 'none',
          borderTopRightRadius: 'unset',
          borderBottomRightRadius: 'unset',
          borderTopLeftRadius: 'unset',
          borderBottomLeftRadius: 'unset',
        },
      },

      input: {
        /* paddings specified for classes used outside React component */
        '&:not(:first-child)': {
          paddingLeft: prefixSuffixStaticWidth,
        },
        '&:not(:last-child)': {
          paddingRight: prefixSuffixStaticWidth,
        },
        '&[readonly]': {
          cursor: 'default',
        },
      },
    }),

    input: cx(
      getFocusStyle(theme),
      sharedInputStyle(theme, invalid),
      css({
        label: 'input-input',
        position: 'relative',
        zIndex: 0,
        flexGrow: 1,
        borderRadius: theme.shape.radius.default,
        height: '100%',
        width: '100%',
      })
    ),
    inputDisabled: css({
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabledText,
      border: `1px solid ${theme.colors.action.disabledBackground}`,
      '&:focus': {
        boxShadow: 'none',
      },
    }),
    addon: css({
      label: 'input-addon',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      flexGrow: 0,
      flexShrink: 0,
      position: 'relative',

      '&:first-child': {
        borderTopRightRadius: 'unset',
        borderBottomRightRadius: 'unset',
        '> :last-child': {
          borderTopRightRadius: 'unset',
          borderBottomRightRadius: 'unset',
        },
      },

      '&:last-child': {
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
        '> :first-child': {
          borderTopLeftRadius: 'unset',
          borderBottomLeftRadius: 'unset',
        },
      },
      '> *:focus': {
        /* we want anything that has focus and is an addon to be above input */
        zIndex: 2,
      },
    }),
    prefix: cx(
      prefixSuffix,
      css({
        label: 'input-prefix',
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(0.5),
        borderRight: 'none',
        borderTopRightRadius: 'unset',
        borderBottomRightRadius: 'unset',
      })
    ),
    suffix: cx(
      prefixSuffix,
      css({
        label: 'input-suffix',
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1),
        borderLeft: 'none',
        borderTopLeftRadius: 'unset',
        borderBottomLeftRadius: 'unset',
        right: 0,
      })
    ),
    loadingIndicator: css({
      '& + *': {
        marginLeft: theme.spacing(0.5),
      },
    }),
  };
});
