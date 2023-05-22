import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, useCallback } from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';
import { Tooltip } from '../Tooltip/Tooltip';

export type BadgeColor = 'blue' | 'red' | 'green' | 'orange' | 'purple';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  text: React.ReactNode;
  color: BadgeColor;
  icon?: IconName;
  tooltip?: string;
}

export const Badge = React.memo<BadgeProps>(({ icon, color, text, tooltip, className, ...otherProps }) => {
  const styles = useStyles2(useCallback((theme) => getStyles(theme, color), [color]));
  const badge = (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      <HorizontalGroup align="center" spacing="xs">
        {icon && <Icon name={icon} size="sm" />}
        <span>{text}</span>
      </HorizontalGroup>
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

Badge.displayName = 'Badge';

const getStyles = (theme: GrafanaTheme2, color: BadgeColor) => {
  let sourceColor = theme.visualization.getColorByName(color);
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (theme.isDark) {
    bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
    borderColor = tinycolor(sourceColor).darken(30).toString();
    textColor = tinycolor(sourceColor).lighten(15).toString();
  } else {
    bgColor = tinycolor(sourceColor).setAlpha(0.15).toString();
    borderColor = tinycolor(sourceColor).lighten(20).toString();
    textColor = tinycolor(sourceColor).darken(20).toString();
  }

  return {
    wrapper: css`
      font-size: ${theme.typography.size.sm};
      display: inline-flex;
      padding: 1px 4px;
      border-radius: ${theme.shape.radius.default};
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};
      font-weight: ${theme.typography.fontWeightRegular};

      > span {
        position: relative;
        top: 1px;
        margin-left: 2px;
      }
    `,
  };
};
