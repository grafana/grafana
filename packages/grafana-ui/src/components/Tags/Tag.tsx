import { cx, css } from '@emotion/css';
import { type CSSProperties, forwardRef, type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { type SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { getTagColorIndexFromName, getTagTextChannelVariables, getTagColorVariables } from '../../utils/tags';
import { Icon } from '../Icon/Icon';

/**
 * @public
 */
export type OnTagClick = (name: string, event: React.MouseEvent<HTMLElement>) => void;

export interface Props extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  /** Name of the tag to display */
  name: string;
  icon?: IconName;
  /** Use constant color from TAG_COLORS. Using index instead of color directly so we can match other styling.
   * The index wraps around, so a value beyond the number of colors is fine. */
  colorIndex?: number;
  /** Base CSS color for a tonal background and foreground pair. Takes precedence over colorIndex. */
  baseColor?: string;
  onClick?: OnTagClick;
}

const TagComponent = forwardRef<HTMLElement, Props>(
  ({ name, onClick, icon, className, colorIndex, baseColor, style, ...rest }, ref) => {
    const theme = useTheme2();
    const styles = useStyles2(getTagStyles);
    // Colors are inline custom properties so the class stays the same for every tag color.
    const colorStyle: CSSProperties = {
      ...getTagColorVariables(baseColor ?? colorIndex ?? getTagColorIndexFromName(name, theme), theme),
      ...style,
    };

    const onTagClick = (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      onClick?.(name, event);
    };

    const classes = cx(styles.wrapper, className, { [styles.hover]: onClick !== undefined });

    return onClick ? (
      <button
        {...rest}
        className={classes}
        style={colorStyle}
        onClick={onTagClick}
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
      >
        {icon && <Icon name={icon} />}
        {name}
      </button>
    ) : (
      <span {...rest} className={classes} style={colorStyle} ref={ref}>
        {icon && <Icon name={icon} />}
        {name}
      </span>
    );
  }
);
TagComponent.displayName = 'Tag';

const TagSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);
  return <Skeleton width={60} height={22} containerClassName={styles.container} {...rootProps} />;
};

/**
 * Used for displaying metadata, for example to add more details to search results. Background and border colors are generated from the tag name.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-tag--docs
 */
export const Tag = attachSkeleton(TagComponent, TagSkeleton);

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const getTagStyles = (theme: GrafanaTheme2) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  return {
    wrapper: css(
      {
        ...getTagTextChannelVariables(theme),
        appearance: 'none',
        borderStyle: 'none',
        fontWeight: theme.typography.fontWeightMedium,
        fontSize: theme.typography.size.sm,
        lineHeight: theme.typography.bodySmall.lineHeight,
        verticalAlign: 'baseline',
        backgroundColor: 'var(--tag-background)',
        color: 'var(--tag-text)',
        whiteSpace: 'pre',
        textShadow: 'none',
        padding: '3px 6px',
        borderRadius: theme.shape.radius.sm,
      },
      visualRefreshEnabled && {
        gap: '3px',
        borderRadius: theme.shape.radius.pill,
        padding: `3px ${theme.spacing.x1}`,
        // needed for the icon/text gap below to take effect
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.fontWeightRegular,
      }
    ),
    hover: css({
      '&:hover': {
        opacity: 0.85,
        cursor: 'pointer',
      },
    }),
  };
};
