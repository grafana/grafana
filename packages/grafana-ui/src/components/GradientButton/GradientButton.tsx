import { cx } from '@emotion/css';
import * as React from 'react';

import { useStyles2 } from '../../themes/ThemeContext';
import { AbstractButton } from '../AbstractButton/AbstractButton';
import { type ButtonProps } from '../Button/Button';

import { getGradientButtonStyles } from './GradientButton.styles';

// Omit does not distribute over a union, and would drop the aria-label or tooltip requirement of icon-only buttons.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type GradientButtonFill = 'outline' | 'solid';
export const allGradientButtonFills: GradientButtonFill[] = ['outline', 'solid'];

export type GradientButtonProps = DistributiveOmit<ButtonProps, 'variant' | 'fill'> & {
  /** `outline` draws a 1px gradient border on the secondary button color. `solid` fills the button with the gradient. */
  fill?: GradientButtonFill;
  /** Defaults to `ai-sparkle`. Only override it for a loading or cancel state, such as `spinner` while a response is generating. */
  icon?: ButtonProps['icon'];
};

/**
 * A button with a gradient border or fill from the `theme.colors.gradients.button` theme token.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-gradientbutton--docs
 */
export const GradientButton = React.forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ fill = 'outline', size = 'md', fullWidth = false, icon = 'ai-sparkle', className, ...props }, ref) => {
    const styles = useStyles2(getGradientButtonStyles, fill, size, fullWidth, !props.children);

    return (
      <AbstractButton
        {...props}
        ref={ref}
        as="button"
        icon={icon}
        className={cx(styles.button, { [styles.disabled]: props.disabled }, className)}
        iconSize={size}
        iconClassName={styles.icon}
        contentClassName={styles.content}
      />
    );
  }
);

GradientButton.displayName = 'GradientButton';
