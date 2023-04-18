import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme, dateTime, GrafanaTheme2 } from '@grafana/data';

import { useStyles, useStyles2 } from '../../themes';
import { Button } from '../Button';
import { Tooltip } from '../Tooltip';

export interface RecentUser {
  id: number;
  name?: string;
  avatarUrl: string;
  login: string;
  email?: string;
  hasCustomAvatar?: boolean;
}

export interface UserViewDTO {
  user: RecentUser;
  viewed: string;
}

export interface UserIconProps {
  /** An object that contains the user's details and 'viewed' status */
  userView: UserViewDTO;
  /** A boolean value that determines whether the tooltip should be shown or not */
  showTooltip?: boolean;
  /** A boolean value that determines whether the border should be shown or not.
   * Used when displaying multiple icons to prevent transparent overlay. */
  showBorder?: boolean;
  /** An optional class name to be added to the icon element */
  className?: string;
}

/**
 * A helper function that takes in a dateString parameter
 * and returns the user's last viewed date in a specific format.
 */
const formatViewed = (dateString: string): string => {
  const date = dateTime(dateString);
  const diffHours = date.diff(dateTime(), 'hours', false);
  return `Active last ${(Math.floor(-diffHours / 24) + 1) * 24}h`;
};

export const UserIcon = ({ userView, showTooltip = true, showBorder = false, className }: UserIconProps) => {
  const { user, viewed } = userView;
  const isActive = dateTime(viewed).diff(dateTime(), 'minutes', true) >= -15;

  const styles = useStyles((theme) => getStyles(theme, isActive, showBorder));

  const userDisplayName = user.name || user.login;
  const initialsArray = userDisplayName.split(' ');
  const initials = (
    (initialsArray.shift()?.slice(0, 1) || '') + (initialsArray.pop()?.slice(0, 1) || '')
  ).toUpperCase();

  const content =
    user.avatarUrl && user.hasCustomAvatar ? (
      <img
        className={cx(styles.icon, className)}
        src={user.avatarUrl}
        aria-label="Avatar icon"
        alt={`${initials} avatar`}
      />
    ) : (
      <Button variant="secondary" className={cx(styles.textIcon, styles.icon, className)} aria-label="Initials icon">
        {initials}
      </Button>
    );

  if (showTooltip) {
    const tooltip = (
      <div className={styles.tooltipContainer}>
        <div className={styles.tooltipName}>{userDisplayName}</div>
        <div className={styles.tooltipDate}>
          {isActive ? (
            <>
              <span>Active last 15m</span>
              <span className={styles.dot}></span>
            </>
          ) : (
            formatViewed(viewed)
          )}
        </div>
      </div>
    );

    return (
      <Tooltip content={tooltip} key={`recent-user-${user.id}`}>
        {content}
      </Tooltip>
    );
  } else {
    return content;
  }
};

const getIconBorder = (color: string): string => {
  return `0 0 0 1px ${color}`;
};

export const getStyles = (theme: GrafanaTheme, isActive: boolean, showBorder: boolean) => {
  const shadowColor = isActive ? theme.palette.blue80 : theme.colors.border2;
  const shadowHoverColor = isActive ? theme.palette.blue95 : theme.colors.border3;
  const borderColor = showBorder ? theme.colors.dashboardBg : 'transparent';

  return {
    icon: css`
      border-radius: 50%;
      width: 30px;
      height: 30px;
      margin-left: -6px;
      border: 3px ${borderColor} solid;
      box-shadow: ${getIconBorder(shadowColor)};
      background-clip: padding-box;
      &:hover {
        background-clip: padding-box;
        box-shadow: ${getIconBorder(shadowHoverColor)};
      }
    `,
    textIcon: css`
      padding: 0px;
      text-align: center;
      line-height: 22px;
      justify-content: center;
      color: ${theme.colors.textSemiWeak};
      cursor: auto;
      font-size: ${theme.typography.size.sm};
      background: ${theme.isDark ? theme.palette.dark9 : theme.palette.gray90};
      &:focus {
        box-shadow: ${getIconBorder(shadowColor)};
      }
      &:hover {
        background: ${theme.isDark ? theme.palette.dark10 : theme.palette.gray95};
      }
    `,
    tooltipContainer: css`
      text-align: center;
      padding: 0px ${theme.spacing.sm};
    `,
    tooltipName: css`
      font-weight: ${theme.typography.weight.bold};
    `,
    tooltipDate: css`
      font-weight: ${theme.typography.weight.regular};
    `,
    dot: css`
      height: 6px;
      width: 6px;
      background-color: ${theme.palette.blue80};
      border-radius: 50%;
      display: inline-block;
      margin-left: 6px;
      margin-bottom: 1px;
    `,
  };
};
