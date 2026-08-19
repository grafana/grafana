import { css, cx } from '@emotion/css';
import { type HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';

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

type BadgeToneColors = { border: string; text: string; background: string };

/** Dark-mode badge colors: text = 300, border = 800, background = 950 */
const darkBadgeColors: Record<Exclude<BadgeColor, 'brand'>, BadgeToneColors> = {
  blue: { border: palette.blue800, text: palette.blue300, background: palette.blue950 },
  red: { border: palette.red800, text: palette.red300, background: palette.red950 },
  green: { border: palette.sage800, text: palette.sage300, background: palette.sage950 },
  orange: { border: palette.orange800, text: palette.orange300, background: palette.orange950 },
  purple: { border: palette.violet800, text: palette.violet300, background: palette.violet950 },
  darkgrey: { border: palette.ink800, text: palette.ink300, background: palette.ink950 },
};

/** Light-mode badge colors: text = 800, border = 200, background = 100 */
const lightBadgeColors: Record<Exclude<BadgeColor, 'brand'>, BadgeToneColors> = {
  blue: { border: palette.blue200, text: palette.blue800, background: palette.blue100 },
  red: { border: palette.red200, text: palette.red800, background: palette.red100 },
  green: { border: palette.sage200, text: palette.sage800, background: palette.sage100 },
  orange: { border: palette.orange200, text: palette.orange800, background: palette.orange100 },
  purple: { border: palette.violet200, text: palette.violet800, background: palette.violet100 },
  darkgrey: { border: palette.neutral200, text: palette.neutral800, background: palette.neutral100 },
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

  return <Skeleton width={60} height={24} containerClassName={styles.container} {...rootProps} />;
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
    borderColor = theme.isDark ? palette.orange800 : palette.orange200;
    textColor = theme.colors.primary.contrastText;
  } else {
    const colors = theme.isDark ? darkBadgeColors[color] : lightBadgeColors[color];
    bgColor = colors.background;
    borderColor = colors.border;
    textColor = colors.text;
  }

  return {
    wrapper: css({
      display: 'inline-flex',
      height: 24,
      padding: '1px 6px',
      borderRadius: theme.shape.radius.pill,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
      fontWeight: theme.typography.fontWeightRegular,
      gap: theme.spacing(0.5),
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      alignItems: 'center',

      '&:focus-visible': {
        outline: `2px solid ${theme.colors.accent.main}`,
        outlineOffset: '-2px',
      },
    }),
    iconWrap: css({
      display: 'inline-flex',
      alignItems: 'center',
    }),
  };
};
