import { css, cx } from '@emotion/css';
import { type AnchorHTMLAttributes } from 'react';
import * as React from 'react';

import { useTheme2 } from '../../themes/ThemeContext';
import { AbstractButton } from '../AbstractButton/AbstractButton';
import { type ButtonProps } from '../Button/Button';
import { getButtonStyles } from '../Button/StyledButton.styles';

export type ButtonLinkProps = ButtonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-label'>;

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      'aria-label': ariaLabel,
      variant = 'primary',
      size = 'md',
      fill = 'solid',
      icon,
      iconPlacement = 'left',
      fullWidth,
      children,
      className,
      onBlur,
      onFocus,
      disabled,
      tooltip,
      tooltipPlacement,
      href,
      ...otherProps
    },
    ref
  ) => {
    const theme = useTheme2();
    const styles = getButtonStyles({
      theme,
      fullWidth,
      size,
      variant,
      fill,
      iconOnly: !children,
    });

    const linkButtonStyles = cx(
      styles.button,
      {
        [css(styles.disabled, {
          pointerEvents: 'none',
        })]: disabled,
      },
      className
    );

    return (
      <AbstractButton
        ref={ref}
        className={linkButtonStyles}
        icon={icon}
        iconSize={size}
        iconPlacement={iconPlacement}
        iconClassName={styles.icon}
        contentClassName={styles.content}
        tooltip={tooltip}
        tooltipPlacement={tooltipPlacement}
        disabled={disabled}
        aria-label={ariaLabel}
        {...otherProps}
        href={href}
        as="a"
      >
        {children}
      </AbstractButton>
    );
  }
);

LinkButton.displayName = 'LinkButton';
