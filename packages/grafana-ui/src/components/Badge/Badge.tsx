import { css, cx } from '@emotion/css';
import { type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { type SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { Icon } from '../Icon/Icon';
import { TruncatedText } from '../Text/TruncatedText';
import { Tooltip } from '../Tooltip/Tooltip';
import { type PopoverContent } from '../Tooltip/types';

export type BadgeColor = keyof GrafanaTheme2['components']['badge'];

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  text?: React.ReactNode;
  color: BadgeColor;
  icon?: IconName;
  tooltip?: PopoverContent;
}

const BadgeComponent = React.memo<BadgeProps>(({ icon, color, text, tooltip, className, ...otherProps }) => {
  const styles = useStyles2(getStyles, color);

  const textElement = (ref?: React.ForwardedRef<HTMLElement>) => (
    <span className={styles.text} ref={ref}>
      {text}
    </span>
  );

  const textNode =
    text == null ? null : !tooltip ? <TruncatedText childElement={textElement}>{text}</TruncatedText> : textElement();

  const badge = (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {icon && (
        <span className={styles.iconWrap}>
          <Icon name={icon} size="sm" />
        </span>
      )}
      {textNode}
    </div>
  );

  return tooltip ? (
    <Tooltip content={tooltip} placement="auto">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
});
BadgeComponent.displayName = 'Badge';

const BadgeSkeleton: SkeletonComponent = ({ rootProps }) => {
  const styles = useStyles2(getSkeletonStyles);

  return <Skeleton width={60} height={22} containerClassName={styles.container} {...rootProps} />;
};

/**
 * The badge component adds meta information to other content, for example about release status or new elements. You can add any `Icon` component or use the badge without an icon.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/information-badge--docs
 */
export const Badge = attachSkeleton(BadgeComponent, BadgeSkeleton);

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const getStyles = (theme: GrafanaTheme2, color: BadgeColor) => {
  let badgeColor = theme.components.badge[color];

  // the color prop is typed, but callers ignoring the typings would otherwise crash the whole tree
  if (!badgeColor) {
    const message = `Badge: unknown color '${color}', falling back to 'darkgrey'`;
    console.warn(message);

    if (process.env.NODE_ENV === 'development') {
      throw new Error(message);
    }

    badgeColor = theme.components.badge.darkgrey;
  }

  const { background, border, text } = badgeColor;

  return {
    wrapper: css(
      {
        display: 'inline-flex',
        padding: '1px 4px',
        borderRadius: theme.shape.radius.sm,
        background,
        border: `1px solid ${border}`,
        color: text,
        fontWeight: theme.typography.fontWeightRegular,
        gap: theme.spacing(0.5),
        fontSize: theme.typography.bodySmall.fontSize,
        lineHeight: theme.typography.bodySmall.lineHeight,
        alignItems: 'flex-start',
        '&:focus-visible': {
          outline: `2px solid ${theme.colors.accent.main}`,
          outlineOffset: '-2px',
        },
      },
      theme.flags.visualDesignRefresh && {
        padding: '1px 6px',
        borderRadius: theme.shape.radius.pill,
        // lets the badge shrink below its content size when a flex/grid parent constrains it
        minWidth: 0,
      }
    ),
    iconWrap: css({
      display: 'inline-flex',
      alignItems: 'center',
      height: '1lh',
      // keep the icon from being squeezed once the text starts truncating
      flexShrink: 0,
    }),
    text: css(
      theme.flags.visualDesignRefresh && {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        // flex items default to min-width: auto (their own content size); override so nowrap text can shrink
        minWidth: 0,
      }
    ),
  };
};
