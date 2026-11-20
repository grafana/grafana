import { css, cx } from '@emotion/css';

import { useTheme2 } from '../../themes/ThemeContext';
import { type ComponentSize } from '../../types/size';
import { AbstractButton, type AbstractButtonProps } from '../AbstractButton/AbstractButton';

import { type ButtonFill, type ButtonVariant } from './Button';
import { getButtonStyles } from './StyledButton.styles';

// Omit does not distribute over a union, and would collapse the button and anchor forms into one.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

interface StyleProps {
  size?: ComponentSize;
  variant?: ButtonVariant;
  fill?: ButtonFill;
  fullWidth?: boolean;
}

export type StyledButtonProps = StyleProps &
  DistributiveOmit<AbstractButtonProps, 'iconSize' | 'iconClassName' | 'contentClassName'>;

/**
 * The shared implementation of Button and LinkButton: an AbstractButton with the button styles applied.
 * Internal to @grafana/ui. Use Button or LinkButton instead.
 */
export const StyledButton = ({
  size = 'md',
  variant = 'primary',
  fill = 'solid',
  fullWidth,
  className,
  ...props
}: StyledButtonProps) => {
  const theme = useTheme2();
  const styles = getButtonStyles({
    theme,
    size,
    variant,
    fill,
    fullWidth,
    iconOnly: !props.children,
  });

  // A disabled anchor is still clickable, so it also has to ignore pointer events.
  const disabledClassName = props.as === 'a' ? css(styles.disabled, { pointerEvents: 'none' }) : styles.disabled;

  return (
    <AbstractButton
      {...props}
      className={cx(styles.button, { [disabledClassName]: props.disabled }, className)}
      iconSize={size}
      iconClassName={styles.icon}
      contentClassName={styles.content}
    />
  );
};

StyledButton.displayName = 'StyledButton';
