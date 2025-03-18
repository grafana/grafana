import { css, cx } from '@emotion/css';
import { HTMLAttributes } from 'react';
import * as React from 'react';
import Skeleton from 'react-loading-skeleton';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types';
import { SkeletonComponent, attachSkeleton } from '../../utils/skeleton';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

export type BadgeColor = 'blue' | 'red' | 'green' | 'orange' | 'purple';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  text: React.ReactNode;
  color: BadgeColor;
  icon?: IconName;
  tooltip?: string;
}

const BadgeComponent = React.memo<BadgeProps>(({ icon, color, text, tooltip, className, ...otherProps }) => {
  const styles = useStyles2(getStyles, color);
  const badge = (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      {icon && <Icon name={icon} size="sm" />}
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

export const Badge = attachSkeleton(BadgeComponent, BadgeSkeleton);

const getSkeletonStyles = () => ({
  container: css({
    lineHeight: 1,
  }),
});

const getStyles = (theme: GrafanaTheme2, color: BadgeColor) => {
  let sourceColor = theme.visualization.getColorByName(color);
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (theme.isDark) {
    bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
    borderColor = tinycolor(sourceColor).setAlpha(0.25).toString();
    textColor = tinycolor(sourceColor).lighten(15).toString();
  } else {
    bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
    borderColor = tinycolor(sourceColor).setAlpha(0.25).toString();
    textColor = tinycolor(sourceColor).darken(20).toString();
  }

  return {
    wrapper: css({
      display: 'inline-flex',
      padding: '1px 4px',
      borderRadius: theme.shape.radius.default,
      background: bgColor,
      border: `1px solid ${borderColor}`,
      color: textColor,
      fontWeight: theme.typography.fontWeightRegular,
      gap: '2px',
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      alignItems: 'center',
    }),
  };
};
