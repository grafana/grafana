import { css, cx } from '@emotion/css';
import React, { HTMLAttributes, useCallback } from 'react';
import { useStyles2 } from 'src/themes/ThemeContext';

import { GrafanaTheme2 } from '@grafana/data';

import { IconName } from '../../types';
import { Icon } from '../Icon/Icon';
import { HorizontalGroup } from '../Layout/Layout';
import { Tooltip } from '../Tooltip/Tooltip';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  text: React.ReactNode;
  icon?: IconName;
  tooltip?: string;
}

export const AutoSaveBadge = React.memo<BadgeProps>(({ icon, color, text, tooltip, className, ...otherProps }) => {
  const styles = useStyles2(getStyles);
  const badge = (
    <div className={cx(styles.wrapper, className)} {...otherProps}>
      <HorizontalGroup align="center" spacing="xs">
        <span>{text}</span>
        {icon && <Icon name={icon} size="sm" />}
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

AutoSaveBadge.displayName = 'Badge';

const getStyles = (theme: GrafanaTheme2) => {
  let borderColor = '';
  let bgColor = '';
  let textColor = '';

  if (theme.isDark) {
    bgColor = theme.colors.background.canvas;
    borderColor = theme.colors.background.canvas;
    textColor = theme.colors.text.primary;
  } else {
    bgColor = theme.colors.background.canvas;
    borderColor = theme.colors.background.canvas;
    textColor = theme.colors.text.primary;
  }

  return {
    wrapper: css`
      font-size: ${theme.typography.size.sm};
      display: inline-flex;
      padding: 1px 4px;
      border-radius: 3px;
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
