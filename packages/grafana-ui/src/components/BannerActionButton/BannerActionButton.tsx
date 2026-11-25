import { css, cx } from '@emotion/css';

import { useTheme2 } from '../../themes/ThemeContext';
import { AbstractButton, type AbstractButtonProps } from '../AbstractButton/AbstractButton';
import { type AlertVariant } from '../Alert/Alert';

import { getStyles } from './BannerActionButton.styles';

// Omit does not distribute over a union, and would collapse the button and anchor forms into one.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

type ColorProps =
  | {
      /** Colors the button for a banner of this severity, with the outline styles of the matching Button variant. */
      severity?: AlertVariant;
      customColor?: never;
    }
  | {
      /**
       * Colors the outline and the text of the button, for a banner whose colors are not a severity's. The hover colors
       * are derived from it.
       */
      customColor: string;
      severity?: never;
    };

export type BannerActionButtonProps = DistributiveOmit<
  AbstractButtonProps,
  'className' | 'iconSize' | 'iconClassName' | 'contentClassName'
> &
  ColorProps;

/**
 * The action button of a banner: an outline button in the colors of a severity or in a custom color. With neither, it
 * has a black border and black text in light themes, and white ones in dark themes, for a saturated background. Its
 * styles are its own, so that they can change without affecting Button.
 */
export const BannerActionButton = ({ severity, customColor, ...props }: BannerActionButtonProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, !props.children, severity, customColor);

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

BannerActionButton.displayName = 'BannerActionButton';
