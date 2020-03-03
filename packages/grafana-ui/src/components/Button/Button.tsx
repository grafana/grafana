import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { ThemeContext } from '../../themes';
import { getButtonStyles } from './styles';
import { ButtonContent } from './ButtonContent';
import { ButtonSize, ButtonStyles, ButtonVariant } from './types';
import { cx } from 'emotion';

type CommonProps = {
  size?: ButtonSize;
  variant?: ButtonVariant;
  /**
   * icon prop is a temporary solution. It accepts legacy icon class names for the icon to be rendered.
   * TODO: migrate to a component when we are going to migrate icons to @grafana/ui
   */
  icon?: string;
  className?: string;
  styles?: ButtonStyles;
};

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  const theme = useContext(ThemeContext);
  const { size, variant, icon, children, className, styles: stylesProp, ...buttonProps } = props;

  // Default this to 'button', otherwise html defaults to 'submit' which then submits any form it is in.
  buttonProps.type = buttonProps.type || 'button';

  const styles: ButtonStyles =
    stylesProp ||
    getButtonStyles({
      theme,
      size: size || 'md',
      variant: variant || 'primary',
      textAndIcon: !!(children && icon),
    });

  return (
    <button className={cx(styles.button, className)} {...buttonProps} ref={ref}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </button>
  );
});

Button.displayName = 'Button';

export type LinkButtonProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    // We allow disabled here even though it is not standard for a link. We use it as a selector to style it as
    // disabled.
    disabled?: boolean;
  };

export const LinkButton = React.forwardRef<HTMLAnchorElement, LinkButtonProps>((props, ref) => {
  const theme = useContext(ThemeContext);
  const { size, variant, icon, children, className, styles: stylesProp, ...anchorProps } = props;
  const styles: ButtonStyles =
    stylesProp ||
    getButtonStyles({
      theme,
      size: size || 'md',
      variant: variant || 'primary',
      textAndIcon: !!(children && icon),
    });

  return (
    <a className={cx(styles.button, className)} {...anchorProps} ref={ref}>
      <ButtonContent icon={icon}>{children}</ButtonContent>
    </a>
  );
});
LinkButton.displayName = 'LinkButton';
