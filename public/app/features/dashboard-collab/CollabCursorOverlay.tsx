/**
 * CollabCursorOverlay — renders remote user cursors on the dashboard canvas.
 *
 * Absolutely positioned overlay (pointer-events: none) that renders remote
 * cursors. Mouse tracking is done via a document-level mousemove listener
 * relative to the overlay container, sending at 10Hz throttle with
 * viewport-relative percentages. Labels fade after 3s, stale cursors
 * (no update in 5s) are removed.
 */

import { css } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { throttle, toViewportPercent, CURSOR_THROTTLE_MS, LABEL_FADE_MS, STALE_CURSOR_MS } from './cursor-utils';
import { debugLog } from './debugLog';
import type { CursorUpdate } from './protocol/messages';
import { useCollab } from './useCollab';

interface CursorState {
  cursor: CursorUpdate;
  lastSeen: number;
  labelVisible: boolean;
}

/** Selector for the scrollable dashboard canvas container. */
const CANVAS_SELECTOR = `[data-testid="${selectors.components.DashboardEditPaneSplitter.bodyContainer}"]`;

/**
 * Locate the dashboard canvas element (the scrollable panel grid container).
 * Returns null if the element hasn't mounted yet.
 */
function findCanvasElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>(CANVAS_SELECTOR);
}

export function CollabCursorOverlay() {
  const { connected, cursors, sendCursor } = useCollab();
  const canvasRef = useRef<HTMLElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLElement | null>(null);
  const [cursorStates, setCursorStates] = useState<Map<string, CursorState>>(new Map());
  const styles = useStyles2(getStyles);
  const localUserId = config.bootData?.user?.uid ?? '';

  // Locate the canvas element once it mounts.
  useEffect(() => {
    if (!connected) {
      return;
    }

    // The canvas may not be in the DOM yet when this effect first runs,
    // so poll briefly until we find it (or give up).
    let attempts = 0;
    const maxAttempts = 20;
    const intervalMs = 100;

    function tryFind() {
      const el = findCanvasElement();
      if (el) {
        canvasRef.current = el;
        // Ensure the canvas is a containing block for the absolutely-positioned
        // overlay. The scroll container may not have position: relative by default.
        if (getComputedStyle(el).position === 'static') {
          el.style.position = 'relative';
        }
        setCanvasEl(el);
        return true;
      }
      return false;
    }

    if (tryFind()) {
      return;
    }

    const timer = setInterval(() => {
      attempts++;
      if (tryFind() || attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [connected]);

  // Update cursor states when new cursor data arrives from context
  useEffect(() => {
    setCursorStates((prev) => {
      const next = new Map(prev);
      const now = Date.now();

      cursors.forEach((cursor, userId) => {
        debugLog('Cursor update received', { userId, x: cursor.x, y: cursor.y });
        next.set(userId, {
          cursor,
          lastSeen: now,
          labelVisible: true,
        });
      });

      return next;
    });
  }, [cursors]);

  // Fade labels after LABEL_FADE_MS and remove stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorStates((prev) => {
        const now = Date.now();
        const next = new Map<string, CursorState>();
        let changed = false;

        prev.forEach((state, userId) => {
          const age = now - state.lastSeen;

          if (age > STALE_CURSOR_MS) {
            changed = true;
            return;
          }

          if (state.labelVisible && age > LABEL_FADE_MS) {
            next.set(userId, { ...state, labelVisible: false });
            changed = true;
          } else {
            next.set(userId, state);
          }
        });

        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Throttled cursor send via document-level mousemove
  const sendCursorRef = useRef(sendCursor);
  sendCursorRef.current = sendCursor;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- throttle returns a stable wrapper; inner fn uses refs
  const handleMouseMove = useCallback(
    throttle((e: MouseEvent) => {
      if (!canvasRef.current) {
        return;
      }
      const { x, y } = toViewportPercent(e.clientX, e.clientY, canvasRef.current);
      sendCursorRef.current({
        userId: localUserId,
        displayName: config.bootData?.user?.name ?? '',
        avatarUrl: config.bootData?.user?.gravatarUrl ?? '',
        color: '',
        x,
        y,
      });
    }, CURSOR_THROTTLE_MS),
    [localUserId]
  );

  useEffect(() => {
    if (!connected) {
      return;
    }
    debugLog('CollabCursorOverlay mounted — tracking active');
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      debugLog('CollabCursorOverlay unmounting — tracking stopped');
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [connected, handleMouseMove]);

  if (!connected || !canvasEl) {
    return null;
  }

  // Portal the overlay into the canvas element so cursor positions are
  // relative to the scrollable dashboard content area.
  return createPortal(
    <div className={styles.overlay}>
      {Array.from(cursorStates.entries()).map(([userId, state]) => (
        <RemoteCursor key={userId} cursor={state.cursor} labelVisible={state.labelVisible} canvasRef={canvasRef} />
      ))}
    </div>,
    canvasEl
  );
}

interface RemoteCursorProps {
  cursor: CursorUpdate;
  labelVisible: boolean;
  canvasRef: React.RefObject<HTMLElement | null>;
}

function RemoteCursor({ cursor, labelVisible, canvasRef }: RemoteCursorProps) {
  const styles = useStyles2(getStyles);
  const color = cursor.color || '#e74c3c';

  // Convert scroll-content percentages to pixel positions.
  // The overlay is inside the canvas scroll container, so pixel offsets
  // from its top-left map directly to scroll-content positions.
  const canvas = canvasRef.current;
  const leftPx = canvas ? (cursor.x / 100) * canvas.scrollWidth : 0;
  const topPx = canvas ? (cursor.y / 100) * canvas.scrollHeight : 0;

  return (
    <div
      className={styles.cursor}
      style={{
        transform: `translate(${leftPx}px, ${topPx}px)`,
      }}
    >
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.arrow}
      >
        <path d="M0.5 0.5L15 10L8.5 11L5 19.5L0.5 0.5Z" fill={color} stroke="white" strokeWidth="1" />
      </svg>
      <span
        className={styles.label}
        style={{
          backgroundColor: color,
          opacity: labelVisible ? 1 : 0,
        }}
      >
        {cursor.displayName}
      </span>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    overlay: css({
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: theme.zIndex.tooltip - 1,
      overflow: 'visible',
    }),
    cursor: css({
      position: 'absolute',
      top: 0,
      left: 0,
      // eslint-disable-next-line @grafana/no-unreduced-motion
      transition: 'transform 100ms linear',
      willChange: 'transform',
      pointerEvents: 'none',
    }),
    arrow: css({
      display: 'block',
      filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))',
    }),
    label: css({
      position: 'absolute',
      left: 16,
      top: 12,
      padding: '2px 6px',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.maxContrast,
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      whiteSpace: 'nowrap',
      // eslint-disable-next-line @grafana/no-unreduced-motion
      transition: 'opacity 300ms ease-out',
      pointerEvents: 'none',
    }),
  };
}
