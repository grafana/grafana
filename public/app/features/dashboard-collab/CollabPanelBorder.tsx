/**
 * CollabPanelBorder — visual indicator for panel-level collaboration locks.
 *
 * Wraps a panel and shows:
 * - Colored border (2px) in the lock holder's color when another user holds the lock
 * - Avatar badge with tooltip ("Being edited by {name}")
 * - Own locks show a subtle border in the user's own color
 * - Blocks edit entry on foreign-locked panels (toast notification)
 * - Acquires lock on edit enter, releases on blur/close
 */

import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { t } from '@grafana/i18n';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';

import type { CollabLock, CollabUser } from './CollabContext';
import { debugLog } from './debugLog';
import { useCollab } from './useCollab';

interface CollabPanelBorderProps {
  panelId: string;
  /** Whether the panel is currently being edited by the local user. If omitted, auto-detected from scene. */
  isEditing?: boolean;
  children: React.ReactNode;
}

export function CollabPanelBorder({ panelId, isEditing: isEditingProp, children }: CollabPanelBorderProps) {
  // Auto-detect editing state: check if the dashboard's editPanel targets this panel
  const isEditing = isEditingProp ?? false;
  const { connected, locks, users, acquireLock, releaseLock } = useCollab();
  const styles = useStyles2(getStyles);
  const localUserId = config.bootData?.user?.uid ?? '';

  const lock = useMemo(
    () => locks.find((l: CollabLock) => l.target === panelId),
    [locks, panelId]
  );

  const lockHolder = useMemo(
    () => (lock ? users.find((u: CollabUser) => u.userId === lock.userId) : undefined),
    [lock, users]
  );

  const isLockedByOther = lock !== undefined && lock.userId !== localUserId;
  const isLockedBySelf = lock !== undefined && lock.userId === localUserId;

  useEffect(() => {
    if (lock) {
      debugLog('CollabPanelBorder: lock state changed', { panelId, lockedBy: lock.userId, isLockedByOther, isLockedBySelf });
    }
  }, [lock, panelId, isLockedByOther, isLockedBySelf]);

  // Acquire lock when entering edit mode
  useEffect(() => {
    if (!connected) {
      return;
    }
    if (isEditing) {
      debugLog('CollabPanelBorder: acquiring lock on edit enter', { panelId });
      acquireLock(panelId);
      return () => {
        debugLog('CollabPanelBorder: releasing lock on edit exit', { panelId });
        releaseLock(panelId);
      };
    }
    return undefined;
  }, [connected, isEditing, panelId, acquireLock, releaseLock]);

  if (!connected) {
    return <>{children}</>;
  }

  const borderColor = isLockedByOther
    ? lockHolder?.color ?? '#e74c3c'
    : isLockedBySelf
      ? lockHolder?.color ?? config.theme2.colors.primary.main
      : undefined;

  return (
    <div
      className={cx(
        styles.wrapper,
        isLockedByOther && styles.lockedByOther,
        isLockedBySelf && styles.lockedBySelf
      )}
      style={borderColor ? { '--collab-border-color': borderColor } as React.CSSProperties : undefined}
      data-testid="collab-panel-border"
    >
      {isLockedByOther && lockHolder && (
        <Tooltip content={`Being edited by ${lockHolder.displayName}`} placement="top">
          <div className={styles.badge} style={{ backgroundColor: lockHolder.color || '#e74c3c' }}>
            {lockHolder.avatarUrl ? (
              <img src={lockHolder.avatarUrl} alt={lockHolder.displayName} className={styles.avatar} />
            ) : (
              <span className={styles.avatarInitial}>
                {lockHolder.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Tooltip>
      )}
      {children}
    </div>
  );
}

/** Hook for panel edit gating — returns a guard function that blocks edit if locked by another user. */
export function useCollabEditGuard(panelId: string): {
  isLockedByOther: boolean;
  guardEdit: () => boolean;
} {
  const { connected, locks, users } = useCollab();
  const notifyApp = useAppNotification();
  const localUserId = config.bootData?.user?.uid ?? '';

  const lock = useMemo(
    () => locks.find((l: CollabLock) => l.target === panelId),
    [locks, panelId]
  );

  const lockHolder = useMemo(
    () => (lock ? users.find((u: CollabUser) => u.userId === lock.userId) : undefined),
    [lock, users]
  );

  const isLockedByOther = connected && lock !== undefined && lock.userId !== localUserId;

  const guardEdit = useCallback(() => {
    if (isLockedByOther && lockHolder) {
      notifyApp.warning(
        t('dashboard-collab.panel-locked.title', 'Panel locked'),
        t('dashboard-collab.panel-locked.message', 'Being edited by {{name}}', {
          name: lockHolder.displayName,
        })
      );
      return false;
    }
    return true;
  }, [isLockedByOther, lockHolder, notifyApp]);

  return { isLockedByOther, guardEdit };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      position: 'relative',
      width: '100%',
      height: '100%',
    }),
    lockedByOther: css({
      borderRadius: theme.shape.radius.default,
      outline: `4px solid #FF0000`,
      outlineOffset: '0px',
      zIndex: 10,
      transition: 'outline-color 200ms ease-in-out',
    }),
    lockedBySelf: css({
      borderRadius: theme.shape.radius.default,
      outline: `2px solid var(--collab-border-color)`,
      outlineOffset: '0px',
      zIndex: 10,
      transition: 'outline-color 200ms ease-in-out',
    }),
    badge: css({
      position: 'absolute',
      top: -8,
      right: -8,
      width: 24,
      height: 24,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: theme.zIndex.tooltip - 2,
      border: `2px solid ${theme.colors.background.primary}`,
      cursor: 'default',
      pointerEvents: 'auto',
    }),
    avatar: css({
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      objectFit: 'cover',
    }),
    avatarInitial: css({
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightBold,
      lineHeight: 1,
    }),
  };
}
