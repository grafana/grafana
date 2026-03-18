/**
 * CollabPresenceBar — toolbar showing connected user avatars and save status.
 *
 * Displays colored avatar rings for each connected user, ordered by join time.
 * Shows +N overflow when >5 users. Tooltip shows user name on hover.
 * Save status indicator: green "Saved", yellow "Saving...", orange "Edited",
 * red "Save failed" with retry.
 */

import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import type { CollabUser } from './CollabContext';
import { useCollab } from './useCollab';

export type SaveStatus = 'saved' | 'saving' | 'edited' | 'failed';

interface CollabPresenceBarProps {
  saveStatus?: SaveStatus;
  onRetrySave?: () => void;
}

const MAX_VISIBLE_AVATARS = 5;

export function CollabPresenceBar({ saveStatus = 'saved', onRetrySave }: CollabPresenceBarProps) {
  const { connected, users } = useCollab();
  const styles = useStyles2(getStyles);

  const visibleUsers = useMemo(() => users.slice(0, MAX_VISIBLE_AVATARS), [users]);
  const overflowCount = Math.max(0, users.length - MAX_VISIBLE_AVATARS);

  if (!connected) {
    return null;
  }

  return (
    <div className={styles.bar}>
      <div className={styles.avatarGroup}>
        {visibleUsers.map((user) => (
          <UserAvatar key={user.userId} user={user} />
        ))}
        {overflowCount > 0 && (
          <Tooltip content={`${overflowCount} more user${overflowCount > 1 ? 's' : ''}`}>
            <div className={styles.overflow}>+{overflowCount}</div>
          </Tooltip>
        )}
      </div>
      <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} />
    </div>
  );
}

interface UserAvatarProps {
  user: CollabUser;
}

function UserAvatar({ user }: UserAvatarProps) {
  const styles = useStyles2(getStyles);
  const initials = getInitials(user.displayName);
  const color = user.color || '#888';

  return (
    <Tooltip content={user.displayName} placement="bottom">
      <div
        className={styles.avatar}
        style={{ borderColor: color }}
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className={styles.avatarImg}
          />
        ) : (
          <span className={styles.initials} style={{ backgroundColor: color }}>
            {initials}
          </span>
        )}
      </div>
    </Tooltip>
  );
}

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  onRetry?: () => void;
}

function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps) {
  const styles = useStyles2(getStyles);

  const statusConfig: Record<SaveStatus, { label: string; className: string }> = {
    saved: { label: 'Saved', className: styles.statusSaved },
    saving: { label: 'Saving...', className: styles.statusSaving },
    edited: { label: 'Edited', className: styles.statusEdited },
    failed: { label: 'Save failed', className: styles.statusFailed },
  };

  const { label, className } = statusConfig[status];

  return (
    <div className={cx(styles.status, className)}>
      <span className={styles.statusDot} />
      <span>{label}</span>
      {status === 'failed' && onRetry && (
        <button className={styles.retryButton} onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? '?').toUpperCase();
}

function getStyles(theme: GrafanaTheme2) {
  return {
    bar: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    }),
    avatarGroup: css({
      display: 'flex',
      alignItems: 'center',
      // Overlapping avatars
      '& > *:not(:first-child)': {
        marginLeft: theme.spacing(-0.5),
      },
    }),
    avatar: css({
      width: 28,
      height: 28,
      borderRadius: '50%',
      border: '2px solid',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      backgroundColor: theme.colors.background.secondary,
      flexShrink: 0,
    }),
    avatarImg: css({
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      borderRadius: '50%',
    }),
    initials: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.fontWeightBold,
      borderRadius: '50%',
    }),
    overflow: css({
      width: 28,
      height: 28,
      borderRadius: '50%',
      border: `2px solid ${theme.colors.border.medium}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.background.secondary,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.fontWeightMedium,
      cursor: 'pointer',
      flexShrink: 0,
    }),
    status: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontSize: theme.typography.size.sm,
      whiteSpace: 'nowrap',
    }),
    statusDot: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      flexShrink: 0,
    }),
    statusSaved: css({
      color: theme.colors.success.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.success.main,
      },
    }),
    statusSaving: css({
      color: theme.colors.warning.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.warning.main,
      },
    }),
    statusEdited: css({
      color: theme.v1.palette.orange,
      '& > span:first-of-type': {
        backgroundColor: theme.v1.palette.orange,
      },
    }),
    statusFailed: css({
      color: theme.colors.error.text,
      '& > span:first-of-type': {
        backgroundColor: theme.colors.error.main,
      },
    }),
    retryButton: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.link,
      cursor: 'pointer',
      padding: 0,
      fontSize: theme.typography.size.sm,
      textDecoration: 'underline',
      '&:hover': {
        color: theme.colors.text.maxContrast,
      },
    }),
  };
}
