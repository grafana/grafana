import React from 'react';
import { Icon } from '../Icon/Icon';
import { useTheme } from '../../themes/ThemeContext';
import { stylesFactory } from '../../themes/stylesFactory';
import { IconName } from '../../types';
import { Tooltip } from '../Tooltip/Tooltip';
import { getColorFromHexRgbOrName, GrafanaTheme } from '@grafana/data';
import tinycolor from 'tinycolor2';
import { css } from 'emotion';
import { HorizontalGroup } from '..';

export type BadgeColor = 'blue' | 'red' | 'green' | 'orange' | 'purple';

export interface BadgeProps {
  text: string;
  color: BadgeColor;
  icon?: IconName;
  tooltip?: string;
}

export const Badge = React.memo<BadgeProps>(({ icon, color, text, tooltip }) => {
  const theme = useTheme();
  const styles = getStyles(theme, color);
  const badge = (
    <div className={styles.wrapper}>
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

const getStyles = stylesFactory((theme: GrafanaTheme, color: BadgeColor) => {
  let sourceColor = getColorFromHexRgbOrName(color);
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (theme.isDark) {
    bgColor = tinycolor(sourceColor)
      .darken(38)
      .toString();
    borderColor = tinycolor(sourceColor)
      .darken(25)
      .toString();
    textColor = tinycolor(sourceColor)
      .lighten(45)
      .toString();
  } else {
    bgColor = tinycolor(sourceColor)
      .lighten(30)
      .toString();
    borderColor = tinycolor(sourceColor)
      .lighten(15)
      .toString();
    textColor = tinycolor(sourceColor)
      .darken(40)
      .toString();
  }

  return {
    wrapper: css`
      font-size: ${theme.typography.size.sm};
      display: inline-flex;
      padding: 1px 4px;
      border-radius: 3px;
      margin-top: 6px;
      background: ${bgColor};
      border: 1px solid ${borderColor};
      color: ${textColor};

      > span {
        position: relative;
        top: 1px;
        margin-left: 2px;
      }
    `,
  };
});
