import { css, cx } from '@emotion/css';
import { forwardRef, HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { ButtonVariant } from './Button';

export interface Props extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  /**
   * Needed to get the correct color of the spacing line between buttons
   */
  variant?: ButtonVariant;
}

export const ButtonGroup = forwardRef<HTMLDivElement, Props>(({ className, children, variant, ...rest }, ref) => {
  const styles = useStyles2(getStyles);

  return (
    <div ref={ref} className={cx('button-group', styles.wrapper, variant && styles[variant], className)} {...rest}>
      {children}
    </div>
  );
});

ButtonGroup.displayName = 'ButtonGroup';

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    borderRadius: theme.shape.radius.default,

    '> .button-group:not(:first-child) > button, > button:not(:first-child)': {
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },

    '> .button-group:not(:last-child) > button, > button:not(:last-child)': {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      borderRightWidth: 0,
    },
  }),
  primary: css({ backgroundColor: theme.colors.primary.border, gap: 1 }),
  destructive: css({ backgroundColor: theme.colors.error.border, gap: 1 }),
  secondary: css({}),
  success: css({ gap: 1, backgroundColor: theme.colors.success.border }),
});
