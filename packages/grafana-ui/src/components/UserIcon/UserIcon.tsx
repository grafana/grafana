import { css, cx } from '@emotion/css';
import React, { useMemo, PropsWithChildren } from 'react';

import { dateTime, DateTimeInput, GrafanaTheme2 } from '@grafana/data';

import { useTheme2 } from '../../themes';
import { Button } from '../Button';
import { Tooltip } from '../Tooltip';

export interface UserView {
  user: {
    /** User's name, containing first + last name */
    name: string;
    /** URL to the user's avatar */
    avatarUrl?: string;
  };
  /** Datetime string when the user was last active */
  lastActiveAt: DateTimeInput;
}

export interface UserIconProps {
  /** An object that contains the user's details and 'lastActiveAt' status */
  userView: UserView;
  /** A boolean value that determines whether the tooltip should be shown or not */
  showTooltip?: boolean;
  /** An optional class name to be added to the icon element */
  className?: string;
  /** onClick handler to be called when the icon is clicked */
  onClick?: () => void;
}

/**
 * A helper function that takes in a dateString parameter
 * and returns the user's last viewed date in a specific format.
 */
const formatViewed = (dateString: DateTimeInput): string => {
  const date = dateTime(dateString);
  const diffHours = date.diff(dateTime(), 'hours', false);
  return `Active last ${(Math.floor(-diffHours / 24) + 1) * 24}h`;
};

/**
 * Output the initials of the first and last name (if given), capitalized and concatenated together.
 * If name is not provided, an empty string is returned.
 * @param name
 */
const getUserInitials = (name?: string) => {
  if (!name) {
    return '';
  }
  const [first, last] = name.split(' ');
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
};

export const UserIcon = ({
  userView,
  className,
  children,
  onClick,
  showTooltip = true,
}: PropsWithChildren<UserIconProps>) => {
  const { user, lastActiveAt } = userView;
  const isActive = dateTime(lastActiveAt).diff(dateTime(), 'minutes', true) >= -15;
  const theme = useTheme2();
  const styles = useMemo(() => getStyles(theme, isActive), [theme, isActive]);

  const content = user.avatarUrl ? (
    <img
      className={cx(styles.icon, className)}
      src={user.avatarUrl}
      aria-label="Avatar icon"
      alt={`${user.name} avatar`}
    />
  ) : (
    <Button
      variant="secondary"
      onClick={onClick}
      className={cx(styles.textIcon, styles.icon, className)}
      aria-label={`${user.name} icon`}
    >
      {children || getUserInitials(user.name)}
    </Button>
  );

  if (showTooltip) {
    const tooltip = (
      <div className={styles.tooltipContainer}>
        <div className={styles.tooltipName}>{user.name}</div>
        <div className={styles.tooltipDate}>
          {isActive ? (
            <div className={styles.dotContainer}>
              <span>Active last 15m</span>
              <span className={styles.dot}></span>
            </div>
          ) : (
            formatViewed(lastActiveAt)
          )}
        </div>
      </div>
    );

    return <Tooltip content={tooltip}>{content}</Tooltip>;
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
      margin-left: -${theme.spacing(1)}; // Slightly overlay multiple icons on top of each other
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
