import { css, cx } from '@emotion/css';
import { type HTMLAttributes } from 'react';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

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
  hasDescriptionComponent?: boolean;
  hasTagsComponent?: boolean;
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
  hasDescriptionComponent = false,
  hasTagsComponent = false,
  ...props
}: CardContainerProps) => {
  const { oldContainer } = useStyles2(
    getCardContainerStyles,
    disableEvents,
    disableHover,
    hasDescriptionComponent,
    hasTagsComponent,
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
  hasDescriptionComponent: boolean,
  hasTagsComponent: boolean,
  isSelected?: boolean,
  isCompact?: boolean,
  noMargin = false,
  variant: 'primary' | 'secondary' = 'primary'
) => {
  const isSelectable = isSelected !== undefined;

  const headingRow = `"Figure Heading ${hasTagsComponent && !isSelectable ? 'Tags' : 'Heading'}" ${hasDescriptionComponent ? '' : '1fr'}`;
  const metaRow = `"Figure Meta ${hasTagsComponent ? 'Tags' : 'Meta'}"`;
  const descriptionRow = `"Figure Description ${hasTagsComponent ? 'Tags' : 'Description'}" 1fr`;
  const actionsRow = `"Figure Actions Secondary" / auto 1fr auto`;
  const backgroundColor = variant === 'primary' ? theme.colors.background.primary : theme.colors.background.secondary;

  return {
    container: css({
      display: 'grid',
      position: 'relative',
      gridTemplate: `
        ${headingRow}
        ${metaRow}
        ${hasDescriptionComponent ? descriptionRow : ''}
        ${actionsRow}
      `,
      gridAutoColumns: '1fr',
      gridAutoFlow: 'row',
      width: '100%',
      padding: theme.spacing(isCompact ? 1 : 2),
      background: backgroundColor,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.lg,
      marginBottom: theme.spacing(noMargin ? 0 : 1),
      pointerEvents: disabled ? 'none' : 'auto',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      ...(!disableHover && {
        '&:hover': {
          background: theme.colors.emphasize(backgroundColor, 0.03),
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
      background: backgroundColor,
      borderRadius: theme.shape.radius.lg,
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
          background: theme.colors.emphasize(backgroundColor, 0.03),
          cursor: 'pointer',
          zIndex: 1,
        },
        '&:focus': getFocusStyles(theme),
      }),
    }),
  };
};
