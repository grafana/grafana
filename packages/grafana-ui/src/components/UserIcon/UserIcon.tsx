import { css, cx } from '@emotion/css';
import React from 'react';

import { dateTime, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
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

export const UserIcon = ({ userView, showTooltip = true, className }: UserIconProps) => {
  const { user, viewed } = userView;
  const isActive = dateTime(viewed).diff(dateTime(), 'minutes', true) >= -15;

  const styles = useStyles2((theme) => getStyles(theme, isActive));

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
            <div className={styles.dotContainer}>
              <span>Active last 15m</span>
              <span className={styles.dot}></span>
            </div>
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

export const getStyles = (theme: GrafanaTheme2, isActive: boolean) => {
  const shadowColor = isActive ? theme.colors.primary.main : theme.colors.border.medium;
  const shadowHoverColor = isActive ? theme.colors.primary.text : theme.colors.border.strong;

  return {
    icon: css`
      border-radius: 50%;
      width: 30px;
      height: 30px;
      margin-left: -6px;
      border: 3px ${theme.colors.background.primary} solid;
      box-shadow: ${getIconBorder(shadowColor)};
      background-clip: padding-box;
      &:hover {
        background-clip: padding-box;
        box-shadow: ${getIconBorder(shadowHoverColor)};
      }
    `,
    textIcon: css`
      padding: 0;
      text-align: center;
      line-height: 22px;
      justify-content: center;
      color: ${theme.colors.text.secondary};
      cursor: auto;
      font-size: ${theme.typography.size.sm};
      background: ${theme.colors.background.primary};
      &:focus {
        box-shadow: ${getIconBorder(shadowColor)};
      }
      &:hover {
        background: ${theme.colors.background.primary};
      }
    `,
    tooltipContainer: css`
      text-align: center;
      padding: ${theme.spacing(0, 1)};
    `,
    tooltipName: css`
      font-weight: ${theme.typography.fontWeightBold};
    `,
    tooltipDate: css`
      font-weight: ${theme.typography.fontWeightRegular};
    `,
    dotContainer: css`
      display: flex;
      align-items: center;
    `,
    dot: css`
      height: 6px;
      width: 6px;
      background-color: ${theme.colors.primary.main};
      border-radius: 50%;
      display: inline-block;
      margin-left: ${theme.spacing(1)};
    `,
  };
};
