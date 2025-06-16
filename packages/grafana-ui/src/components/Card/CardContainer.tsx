import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles } from '../../themes/mixins';

/**
 * @public
 */
export interface CardInnerProps {
  href?: string;
  children?: React.ReactNode;
}

/** @deprecated This component will be removed in a future release */
const CardInner = ({ children, href }: CardInnerProps) => {
  const { inner } = useStyles2(getCardInnerStyles);
  return href ? (
    <a className={inner} href={href}>
      {children}
    </a>
  ) : (
    <>{children}</>
  );
};

const getCardInnerStyles = (theme: GrafanaTheme2) => ({
  inner: css({
    display: 'flex',
    width: '100%',
    padding: theme.spacing(2),
  }),
});

/**
 * @public
 */
export interface CardContainerProps extends HTMLAttributes<HTMLOrSVGElement>, CardInnerProps {
  /** Disable pointer events for the Card, e.g. click events */
  disableEvents?: boolean;
  /** No style change on hover */
  disableHover?: boolean;
  /** Makes the card selectable, set to "true" to apply selected styles */
  isSelected?: boolean;
  /** Custom container styles */
  className?: string;
  /** Remove the bottom margin */
  noMargin?: boolean;
}

/** @deprecated Using `CardContainer` directly is discouraged and should be replaced with `Card` */
export const CardContainer = ({
  children,
  disableEvents,
  disableHover,
  isSelected,
  className,
  href,
  noMargin,
  ...props
}: CardContainerProps) => {
  const { oldContainer } = useStyles2(
    getCardContainerStyles,
    disableEvents,
    disableHover,
    isSelected,
    undefined,
    noMargin
  );

  return (
    <div {...props} className={cx(oldContainer, className)}>
      <CardInner href={href}>{children}</CardInner>
    </div>
  );
};

export const getCardContainerStyles = (
  theme: GrafanaTheme2,
  disabled = false,
  disableHover = false,
  isSelected?: boolean,
  isCompact?: boolean,
  noMargin = false
) => {
  const isSelectable = isSelected !== undefined;

  return {
    container: css({
      display: 'grid',
      position: 'relative',
      gridTemplateColumns: 'auto 1fr auto',
      gridTemplateRows: '1fr auto auto auto',
      gridAutoColumns: '1fr',
      gridAutoFlow: 'row',
      gridTemplateAreas: `
        "Figure Heading Tags"
        "Figure Meta Tags"
        "Figure Description Tags"
        "Figure Actions Secondary"`,
      width: '100%',
      padding: theme.spacing(isCompact ? 1 : 2),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      marginBottom: theme.spacing(noMargin ? 0 : 1),
      pointerEvents: disabled ? 'none' : 'auto',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      ...(!disableHover && {
        '&:hover': {
          background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
          cursor: 'pointer',
          zIndex: 1,
        },
        '&:focus': getFocusStyles(theme),
      }),

      ...(isSelectable && {
        cursor: 'pointer',
      }),

      ...(isSelected && {
        outline: `solid 2px ${theme.colors.primary.border}`,
      }),
    }),
    oldContainer: css({
      display: 'flex',
      width: '100%',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      position: 'relative',
      pointerEvents: disabled ? 'none' : 'auto',
      marginBottom: theme.spacing(noMargin ? 0 : 1),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      ...(!disableHover && {
        '&:hover': {
          background: theme.colors.emphasize(theme.colors.background.secondary, 0.03),
          cursor: 'pointer',
          zIndex: 1,
        },
        '&:focus': getFocusStyles(theme),
      }),
    }),
  };
};
