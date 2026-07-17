import { css, keyframes } from '@emotion/css';
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Portal, Spinner, useStyles2 } from '@grafana/ui';

import { getDashboardEditLocks, subscribeToDashboardEditLocks } from './dashboardEditLockState';

/** Fixed-position insets (viewport-relative), like CSS top/left/right/bottom. */
interface OverlayInsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

const FULL_VIEWPORT: OverlayInsets = { top: 0, left: 0, right: 0, bottom: 0 };

/** Gap between the pill and the overlay's bottom-left corner (theme.spacing(3)). */
const PILL_MARGIN = 24;

/**
 * App-level host for dashboard edit locks. While at least one lock is held
 * (see dashboardEditLockState) it dims the page content area and blocks all
 * pointer interaction with it — but leaves the chrome (top bar, docked menu)
 * and the extension sidebar usable, so the user can follow (and cancel) the
 * assistant conversation driving the edit. A small pill in the overlay's
 * bottom-left corner shows a spinner, what is happening, and a Cancel button
 * when the lock holder supports cancelling.
 */
export function DashboardEditLockHost() {
  const locks = useSyncExternalStore(subscribeToDashboardEditLocks, getDashboardEditLocks);
  const insets = usePageContentInsets(locks.length > 0);
  const styles = useStyles2(getStyles);

  if (locks.length === 0) {
    return null;
  }

  // The most recent lock drives the pill; earlier locks just keep the dim up.
  const lock = locks[locks.length - 1];

  return (
    <Portal>
      <div
        className={styles.overlay}
        style={{ top: insets.top, left: insets.left, right: insets.right, bottom: insets.bottom }}
        data-testid="dashboard-edit-lock-overlay"
      />
      <div
        className={styles.pill}
        style={{ left: insets.left + PILL_MARGIN, bottom: insets.bottom + PILL_MARGIN }}
        data-testid="dashboard-edit-lock-pill"
      >
        <Spinner inline size="sm" />
        <div className={styles.pillBody}>
          <span className={styles.pillLabel}>
            {lock.label ?? t('dashboard-edit-lock.default-label', 'The Assistant is editing this dashboard')}
          </span>
          {lock.status && <span className={styles.pillStatus}>{lock.status}</span>}
        </div>
        {lock.onCancel && (
          <Button size="sm" variant="secondary" fill="outline" onClick={lock.onCancel}>
            {t('dashboard-edit-lock.cancel', 'Cancel')}
          </Button>
        )}
      </div>
    </Portal>
  );
}

/**
 * Tracks the viewport insets of AppChrome's `<main id="pageContent">` content
 * box, so the overlay hugs the page content: the element's box already sits
 * below the fixed top bar, ends before the extension sidebar (max-width), and
 * clears the docked mega menu / scopes drawer through padding — which is why
 * the measurement uses the content box, not the border box. Re-measures on
 * element resize (covers sidebar open/close, menu dock/undock) and window
 * resize. Falls back to the full viewport when the element isn't there
 * (e.g. chromeless pages).
 */
function usePageContentInsets(active: boolean): OverlayInsets {
  const [insets, setInsets] = useState<OverlayInsets>(FULL_VIEWPORT);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }

    const element = document.getElementById('pageContent');
    if (!element) {
      setInsets(FULL_VIEWPORT);
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      setInsets({
        top: Math.max(0, rect.top + parseFloat(style.paddingTop)),
        left: Math.max(0, rect.left + parseFloat(style.paddingLeft)),
        right: Math.max(0, window.innerWidth - rect.right + parseFloat(style.paddingRight)),
        bottom: Math.max(0, window.innerHeight - rect.bottom + parseFloat(style.paddingBottom)),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active]);

  return insets;
}

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const slideUp = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

function getStyles(theme: GrafanaTheme2) {
  return {
    overlay: css({
      position: 'fixed',
      zIndex: theme.zIndex.modal,
      // Translucent: the user watches the dashboard take shape underneath,
      // but the overlay intercepts every pointer event over the content area.
      background: colorManipulator.alpha(theme.colors.background.canvas, 0.7),
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${fadeIn} 150ms ease-out`,
      },
    }),
    pill: css({
      position: 'fixed',
      zIndex: theme.zIndex.modal,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1.5),
      maxWidth: '440px',
      padding: theme.spacing(1, 1.5),
      borderRadius: theme.shape.radius.pill,
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${slideUp} 150ms ease-out`,
      },
    }),
    pillBody: css({
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }),
    pillLabel: css({
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    pillStatus: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
  };
}
