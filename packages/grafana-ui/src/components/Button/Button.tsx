import React, { AnchorHTMLAttributes, ButtonHTMLAttributes, useContext } from 'react';
import { ThemeContext } from '../../themes';
import { getButtonStyles } from './styles';
import { ButtonContent } from './ButtonContent';
import cx from 'classnames';
import { ButtonSize, ButtonStyles, ButtonVariant } from './types';

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

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;
export const Button: React.FunctionComponent<ButtonProps> = props => {
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
    });

  return (
    <button className={cx(styles.button, className)} {...buttonProps}>
      <ButtonContent iconClassName={styles.icon} className={styles.iconWrap} icon={icon}>
        {children}
      </ButtonContent>
    </button>
  );
};
Button.displayName = 'Button';

type LinkButtonProps = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    // We allow disabled here even though it is not standard for a link. We use it as a selector to style it as
    // disabled.
    disabled?: boolean;
  };
export const LinkButton: React.FunctionComponent<LinkButtonProps> = props => {
  const theme = useContext(ThemeContext);
  const { size, variant, icon, children, className, styles: stylesProp, ...anchorProps } = props;
  const styles: ButtonStyles =
    stylesProp ||
    getButtonStyles({
      theme,
      size: size || 'md',
      variant: variant || 'primary',
    });

  return (
    <a className={cx(styles.button, className)} {...anchorProps}>
      <ButtonContent iconClassName={styles.icon} className={styles.iconWrap} icon={icon}>
        {children}
      </ButtonContent>
    </a>
  );
};
LinkButton.displayName = 'LinkButton';
