import { css, cx } from '@emotion/css';
import { type AnchorHTMLAttributes } from 'react';
import * as React from 'react';

import { textUtil } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { type ButtonProps, getButtonStyles, IconRenderer } from '../Button/Button';
import { Tooltip } from '../Tooltip/Tooltip';

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
    const sanitizedHref = href ? textUtil.sanitizeUrl(href) : href;

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

    const iconComponent = icon && <IconRenderer icon={icon} size={size} className={styles.icon} />;

    // When using tooltip, ref is forwarded to Tooltip component instead for https://github.com/grafana/grafana/issues/65632
    const button = (
      <a
        className={linkButtonStyles}
        {...otherProps}
        href={sanitizedHref}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        ref={tooltip ? undefined : ref}
        aria-label={ariaLabel ?? (!children && typeof tooltip === 'string' ? tooltip : undefined)}
      >
        {iconPlacement === 'left' && iconComponent}
        {children && <span className={styles.content}>{children}</span>}
        {iconPlacement === 'right' && iconComponent}
      </a>
    );

    if (tooltip) {
      return (
        <Tooltip ref={ref} content={tooltip} placement={tooltipPlacement}>
          {button}
        </Tooltip>
      );
    }

    return button;
  }
);

LinkButton.displayName = 'LinkButton';
