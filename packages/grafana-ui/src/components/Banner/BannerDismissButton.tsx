import { useTheme2 } from '../../themes/ThemeContext';
import { AbstractButton, type AbstractButtonProps } from '../AbstractButton/AbstractButton';

import { getStyles } from './BannerDismissButton.styles';

// The dismiss button always takes an onClick handler and is never disabled, so its props are AbstractButton's button
// form without `as` or `disabled`.
type AbstractButtonElementProps = Extract<AbstractButtonProps, { as?: 'button' }>;

export type BannerDismissButtonProps = Omit<
  AbstractButtonElementProps,
  'as' | 'disabled' | 'className' | 'iconSize' | 'iconClassName' | 'contentClassName'
> & {
  /** Background of the button. The hover background is derived from it. */
  backgroundColor: string;
  /** Color of the button's text and icon. */
  textColor: string;
};

/**
 * The text dismiss button of a Banner. It is styled like a medium, solid primary Button, but takes its background and
 * text colors as props and has no other appearance options. Its styles are its own, so that they can change without
 * affecting Button.
 */
export const BannerDismissButton = ({ backgroundColor, textColor, ...props }: BannerDismissButtonProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme, backgroundColor, textColor, !props.children);

  return (
    <AbstractButton
      {...props}
      className={styles.button}
      iconSize="md"
      iconClassName={styles.icon}
      contentClassName={styles.content}
      as="button"
    />
  );
};

BannerDismissButton.displayName = 'BannerDismissButton';
