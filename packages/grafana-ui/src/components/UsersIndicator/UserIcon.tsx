import { css, cx } from '@emotion/css';
import { useMemo, PropsWithChildren } from 'react';

import { dateTime, DateTimeInput, GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';

import { useTheme2 } from '../../themes/ThemeContext';
import { Tooltip } from '../Tooltip/Tooltip';

import { UserView } from './types';

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
 * @param {string} [name] The name to extract initials from.
 * @returns {string} The uppercase initials of the first and last name.
 * @example
 * // Returns 'JD'
 * getUserInitials('John Doe');
 * // Returns 'A'
 * getUserInitials('Alice');
 * // Returns ''
 * getUserInitials();
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
  const content = (
    <button
      type={'button'}
      onClick={onClick}
      className={cx(styles.container, onClick && styles.pointer, className)}
      aria-label={t('grafana-ui.user-icon.label', '{{name}} icon', { name: user.name })}
    >
      {children ? (
        <div className={cx(styles.content, styles.textContent)}>{children}</div>
      ) : user.avatarUrl ? (
        <img className={styles.content} src={user.avatarUrl} alt={`${user.name} avatar`} />
      ) : (
        <div className={cx(styles.content, styles.textContent)}>{getUserInitials(user.name)}</div>
      )}
    </button>
  );

  if (showTooltip) {
    const tooltip = (
      <div className={styles.tooltipContainer}>
        <div className={styles.tooltipName}>{user.name}</div>
        <div className={styles.tooltipDate}>
          {isActive ? (
            <div className={styles.dotContainer}>
              <span>
                <Trans i18nKey="grafana-ui.user-icon.active-text">Active last 15m</Trans>
              </span>
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
    container: css({
      padding: 0,
      width: '30px',
      height: '30px',
      background: 'none',
      border: 'none',
      borderRadius: theme.shape.radius.circle,
      '& > *': {
        borderRadius: theme.shape.radius.circle,
      },
    }),
    content: css({
      lineHeight: '24px',
      maxWidth: '100%',
      border: `3px ${theme.colors.background.primary} solid`,
      boxShadow: getIconBorder(shadowColor),
      backgroundClip: 'padding-box',
      '&:hover': {
        boxShadow: getIconBorder(shadowHoverColor),
      },
    }),
    textContent: css({
      background: theme.colors.background.primary,
      padding: 0,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      fontSize: theme.typography.size.sm,
      '&:focus': {
        boxShadow: getIconBorder(shadowColor),
      },
    }),
    tooltipContainer: css({
      textAlign: 'center',
      padding: theme.spacing(0, 1),
    }),
    tooltipName: css({
      fontWeight: theme.typography.fontWeightBold,
    }),
    tooltipDate: css({
      fontWeight: theme.typography.fontWeightRegular,
    }),
    dotContainer: css({
      display: 'flex',
      alignItems: 'center',
    }),
    dot: css({
      height: '6px',
      width: '6px',
      backgroundColor: theme.colors.primary.main,
      borderRadius: theme.shape.radius.circle,
      display: 'inline-block',
      marginLeft: theme.spacing(1),
    }),
    pointer: css({
      cursor: 'pointer',
    }),
  };
};
