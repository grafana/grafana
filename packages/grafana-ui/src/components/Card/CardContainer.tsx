import React, { HTMLAttributes, ReactNode } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaThemeV2 } from '@grafana/data';
import { PopoverContent, Tooltip } from '../Tooltip/Tooltip';
import { styleMixins, stylesFactory, useTheme2 } from '../../themes';

/**
 * @public
 */
export interface ContainerProps extends HTMLAttributes<HTMLOrSVGElement> {
  /** Content for the card's tooltip */
  tooltip?: PopoverContent;
  /** Disable pointer events for the Card, e.g. click events */
  disableEvents?: boolean;
  /** No style change on hover */
  disableHover?: boolean;
  /** Custom container styles */
  className?: string;
}

const Container = ({ children, tooltip, disableEvents, disableHover, className, ...props }: ContainerProps) => {
  const theme = useTheme2();
  const { container } = getCardContainerStyles(theme, disableEvents, disableHover);

  return tooltip ? (
    <Tooltip placement="top" content={tooltip} theme="info">
      <div {...props} className={cx(container, className)}>
        {children}
      </div>
    </Tooltip>
  ) : (
    <div {...props} className={cx(container, className)}>
      {children}
    </div>
  );
};

/**
 * @public
 */
export interface CardInnerProps {
  href?: string;
  children?: ReactNode;
}

const CardInner = ({ children, href }: CardInnerProps) => {
  const theme = useTheme2();
  const { inner } = getCardContainerStyles(theme);
  return href ? (
    <a className={inner} href={href}>
      {children}
    </a>
  ) : (
    <div className={inner}>{children}</div>
  );
};

/**
 * @public
 */
export interface CardContainerProps extends ContainerProps, CardInnerProps {}

export const CardContainer = ({ href, children, ...containerProps }: CardContainerProps) => {
  return (
    <Container {...containerProps}>
      <CardInner href={href}>{children}</CardInner>
    </Container>
  );
};

const getCardContainerStyles = stylesFactory((theme: GrafanaThemeV2, disabled = false, disableHover = false) => {
  return {
    container: css({
      display: 'flex',
      width: '100%',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.borderRadius(),
      position: 'relative',
      pointerEvents: disabled ? 'none' : 'auto',
      marginBottom: theme.spacing(1),
      transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      }),

      ...(!disableHover && {
        '&:hover': {
          background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
          cursor: 'pointer',
          zIndex: 1,
        },
        '&:focus': styleMixins.getFocusStyles(theme),
      }),
    }),
    inner: css({
      display: 'flex',
      width: '100%',
      padding: theme.spacing(2),
    }),
  };
});
