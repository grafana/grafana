import { css, cx } from '@emotion/css';

import { useTheme2 } from '../../themes/ThemeContext';
import { AbstractButton, type AbstractButtonProps } from '../AbstractButton/AbstractButton';

import { getStyles } from './AlertActionButton.styles';

// Omit does not distribute over a union, and would collapse the button and anchor forms into one.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type AlertActionButtonProps = DistributiveOmit<
  AbstractButtonProps,
  'className' | 'iconSize' | 'iconClassName' | 'contentClassName'
>;

/**
 * The action button of an AlertBanner: an outline button with a white border and white text, which hold up on the
 * banner's saturated background. Its styles are its own, so that they can change without affecting Button.
 */
export const AlertActionButton = (props: AlertActionButtonProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, !props.children);

  // A disabled anchor is still clickable, so it also has to ignore pointer events.
  const disabledClassName = props.as === 'a' ? css(styles.disabled, { pointerEvents: 'none' }) : styles.disabled;

  return (
    <AbstractButton
      {...props}
      className={cx(styles.button, { [disabledClassName]: props.disabled })}
      iconSize="md"
      iconClassName={styles.icon}
      contentClassName={styles.content}
    />
  );
};

AlertActionButton.displayName = 'AlertActionButton';
