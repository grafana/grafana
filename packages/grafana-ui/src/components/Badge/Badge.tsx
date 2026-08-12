import { css, cx } from '@emotion/css';
import { type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';
import tinycolor from 'tinycolor2';

import { type GrafanaTheme2 } from '@grafana/data';
import { palette } from '@grafana/data/unstable';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';
import { type SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { type PopoverContent } from '../Tooltip/types';

export type BadgeColor = 'blue' | 'red' | 'green' | 'orange' | 'purple' | 'darkgrey' | 'brand';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  text?: React.ReactNode;
  color: BadgeColor;
  icon?: IconName;
  tooltip?: PopoverContent;
}

/** Dark-mode badge colors from the new palette: text = 300, border = 800, background = 950 */
const darkBadgeColors: Record<Exclude<BadgeColor, 'brand'>, { border: string; text: string; background: string }> = {
  blue: { border: palette.blue800, text: palette.blue300, background: palette.blue950 },
  red: { border: palette.red800, text: palette.red300, background: palette.red950 },
  green: { border: palette.sage800, text: palette.sage300, background: palette.sage950 },
  orange: { border: palette.orange800, text: palette.orange300, background: palette.orange950 },
  purple: { border: palette.violet800, text: palette.violet300, background: palette.violet950 },
  darkgrey: { border: palette.ink800, text: palette.ink300, background: palette.ink950 },
};

const BadgeComponent = React.memo<BadgeProps>(({ icon, color, text, tooltip, className, ...otherProps }) => {
  const styles = useStyles2(getStyles, color);
  const badge = (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {icon && (
        <span className={styles.iconWrap}>
          <Icon name={icon} size="sm" />
        </span>
      )}
      {text}
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
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (color === 'brand') {
    bgColor = theme.colors.gradients.brandHorizontal;
    borderColor = 'transparent';
    textColor = theme.colors.primary.contrastText;
  } else if (theme.isDark) {
    const colors = darkBadgeColors[color];
    bgColor = colors.background;
    borderColor = colors.border;
    textColor = colors.text;
  } else {
    const sourceColor = theme.visualization.getColorByName(color);
    bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
    borderColor = tinycolor(sourceColor).setAlpha(0.25).toString();
    textColor = tinycolor(sourceColor).darken(25).toString();
  }

  return {
    wrapper: css({
      display: 'inline-flex',
      padding: '1px 6px',
      borderRadius: theme.shape.radius.pill,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
      fontWeight: theme.typography.fontWeightRegular,
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      alignItems: 'flex-start',

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.accent.main}`,
        outlineOffset: '-2px',
      },
    }),
    iconWrap: css({
      display: 'inline-flex',
      alignItems: 'center',
      height: '1lh',
    }),
  };
};
