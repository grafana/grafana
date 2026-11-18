import { css } from '@emotion/css';
import { type KeyboardEvent, type PointerEvent, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import {
  DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH,
  getMaxFloatingExtensionSidebarHeight,
  MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH,
  MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH,
} from './constants';
import {
  canCollapseFloatingExtensionSidebar,
  collapseFloatingExtensionSidebar,
  type FloatingExtensionSidebarHeightOptions,
} from './extensionSidebarLayout';
import { FLOATING_SNAP_DURATION_MS } from './useFloatingDrag';

/** The CSS variable the extension sizes its floating surface with, set on the sidebar once the user resized it. */
export const FLOATING_HEIGHT_VARIABLE = '--extension-sidebar-floating-height';

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

// The width handle's clamp, kept apart so that handle stays as it is.
function clampWidth(width: number): number {
  return Math.round(
    Math.min(MAX_FLOATING_EXTENSION_SIDEBAR_WIDTH, Math.max(MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH, width))
  );
}

function clampHeight(height: number, min: number): number {
  return Math.round(Math.min(getMaxFloatingExtensionSidebarHeight(window.innerHeight), Math.max(min, height)));
}

/**
 * Where letting go at `height` leaves the floating sidebar: at that height within the bounds, or collapsed when it is
 * nearer the extension's collapsed height than its minimum.
 */
export function releasedFloatingHeight(
  height: number,
  { minHeight, collapsedHeight }: FloatingExtensionSidebarHeightOptions
): number | 'collapse' {
  if (collapsedHeight !== undefined && height < (collapsedHeight + minHeight) / 2) {
    return 'collapse';
  }
  return clampHeight(height, minHeight);
}

type Edge = 'top' | 'corner';

function reportResized(
  edge: Edge,
  method: 'drag' | 'keyboard' | 'reset',
  size: { width?: number; height?: number } = {}
): void {
  reportInteraction('grafana_extension_sidebar_floating_resized', { edge, method, ...size });
}

interface FloatingHeightHandleProps {
  /** `top` resizes the height; `corner`, on the top-left corner, resizes the width with it. */
  edge: Edge;
  options: FloatingExtensionSidebarHeightOptions;
  /** The height the user resized the sidebar to, or `undefined` while the extension's own height applies. */
  height: number | undefined;
  onHeightChange: (height: number | undefined) => void;
  onWidthChange: (width: number) => void;
}

/**
 * The floating sidebar's top edge, or its top-left corner, for an extension that lets core resize its height. The
 * container is anchored to the bottom right, so dragging up grows it and the corner also widens it to the left.
 * While dragging, the height goes straight to `--extension-sidebar-floating-height`, which the extension sizes its
 * surface with, and is committed on release. Below the minimum it follows down to the extension's collapsed height,
 * and a release nearer to that than to the minimum glides down and asks the extension to collapse. The top edge is
 * an ARIA window splitter: arrow keys step it, and Down at the minimum collapses; the corner is pointer only, since
 * each axis has its own separator. Home or a double-click goes back to the extension's own height.
 */
export function FloatingHeightHandle({
  edge,
  options,
  height,
  onHeightChange,
  onWidthChange,
}: FloatingHeightHandleProps) {
  const styles = useStyles2(getStyles);
  const handleRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    width: number;
    options: FloatingExtensionSidebarHeightOptions;
    floor: number;
  } | null>(null);
  const [renderedHeight, setRenderedHeight] = useState<number | undefined>(undefined);

  const sidebar = () => handleRef.current?.parentElement ?? null;

  // The separator reports the rendered height, which the extension decides until the user resizes it.
  useLayoutEffect(() => {
    const element = handleRef.current?.parentElement;
    if (edge !== 'top' || !element) {
      return;
    }
    const update = () => setRenderedHeight(Math.round(element.getBoundingClientRect().height));
    update();
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [edge]);

  // Writes skip React while dragging and gliding; React writes the committed height on the next render.
  const write = (value: number | undefined) => {
    const element = sidebar();
    if (value === undefined) {
      element?.style.removeProperty(FLOATING_HEIGHT_VARIABLE);
    } else {
      element?.style.setProperty(FLOATING_HEIGHT_VARIABLE, `${value}px`);
    }
  };

  // The glide after a release. The extension's surface follows the variable, which a CSS transition cannot animate
  // unregistered, so it is stepped each frame. A new press finishes it first, running `done` there and then.
  const settling = useRef<{ frame: number; to: number; done: () => void } | null>(null);
  const finishSettling = () => {
    const pending = settling.current;
    if (!pending) {
      return;
    }
    settling.current = null;
    cancelAnimationFrame(pending.frame);
    write(pending.to);
    pending.done();
  };
  const settle = (from: number, to: number, done: () => void) => {
    finishSettling();
    if (Math.round(from) === Math.round(to) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      write(to);
      done();
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / FLOATING_SNAP_DURATION_MS);
      if (progress >= 1) {
        settling.current = null;
        write(to);
        done();
        return;
      }
      write(from + (to - from) * (1 - (1 - progress) ** 3));
      if (settling.current) {
        settling.current.frame = requestAnimationFrame(step);
      }
    };
    settling.current = { frame: requestAnimationFrame(step), to, done };
  };
  useLayoutEffect(() => finishSettling, []); // eslint-disable-line react-hooks/exhaustive-deps -- on unmount only

  // Core offers the collapse only while the extension listens for it, as the drag to the bottom edge does. Read when
  // the gesture starts: the listener comes and goes without a render.
  const collapsibleOptions = (): FloatingExtensionSidebarHeightOptions =>
    canCollapseFloatingExtensionSidebar() ? options : { minHeight: options.minHeight };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    finishSettling();
    const box = sidebar()?.getBoundingClientRect();
    if (!box) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const gestureOptions = collapsibleOptions();
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: box.width,
      startHeight: box.height,
      width: box.width,
      options: gestureOptions,
      // Below the minimum, the drag follows down to the collapsed height, so the collapse a release would make shows.
      floor: gestureOptions.collapsedHeight ?? gestureOptions.minHeight,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    if (edge === 'corner') {
      active.width = clampWidth(active.startWidth + (active.startX - event.clientX));
      onWidthChange(active.width);
    }
    write(clampHeight(active.startHeight + (active.startY - event.clientY), active.floor));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const dragged = active.startHeight + (active.startY - event.clientY);
    const from = clampHeight(dragged, active.floor);
    const released = releasedFloatingHeight(dragged, active.options);
    if (released === 'collapse') {
      const committed = height;
      settle(from, active.floor, () => {
        // The committed height comes back for the next time the extension expands.
        write(committed);
        collapseFloatingExtensionSidebar({ method: 'resize', input: 'pointer' });
      });
      return;
    }
    settle(from, released, () => onHeightChange(released));
    if (released !== Math.round(active.startHeight) || active.width !== active.startWidth) {
      reportResized(edge, 'drag', edge === 'corner' ? { width: active.width, height: released } : { height: released });
    }
  };

  const reset = () => {
    onHeightChange(undefined);
    if (edge === 'corner') {
      onWidthChange(DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
    }
    reportResized(edge, 'reset');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    finishSettling();
    const current = height ?? sidebar()?.getBoundingClientRect().height;
    if (current === undefined) {
      return;
    }
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (
      event.key === 'ArrowDown' &&
      collapsibleOptions().collapsedHeight !== undefined &&
      current <= options.minHeight
    ) {
      event.preventDefault();
      collapseFloatingExtensionSidebar({ method: 'resize', input: 'keyboard' });
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = clampHeight(current + (event.key === 'ArrowUp' ? step : -step), options.minHeight);
      onHeightChange(next);
      reportResized(edge, 'keyboard', { height: next });
    } else if (event.key === 'Home') {
      event.preventDefault();
      reset();
    }
  };

  const pointerHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onDoubleClick: reset,
  };

  if (edge === 'corner') {
    return (
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- a pointer shortcut; each axis has its own keyboard separator
      <div
        ref={handleRef}
        aria-hidden
        className={styles.corner}
        {...pointerHandlers}
        data-testid="extension-sidebar-floating-corner-handle"
      />
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focusable separator is the ARIA window splitter pattern
    <div
      ref={handleRef}
      role="separator"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- as above
      tabIndex={0}
      aria-orientation="horizontal"
      aria-label={t('navigation.extension-sidebar.floating-resize-height', 'Resize sidebar height')}
      aria-valuenow={renderedHeight}
      aria-valuemin={options.minHeight}
      aria-valuemax={getMaxFloatingExtensionSidebarHeight(window.innerHeight)}
      className={styles.top}
      {...pointerHandlers}
      onKeyDown={onKeyDown}
      data-testid="extension-sidebar-floating-height-handle"
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const hitArea = theme.spacing(1);
  const line = '3px';
  // The line straddles the sidebar's 1px border, so its outer edge sits this far outside the sidebar's.
  const outset = `(${line} - 1px) / 2`;
  const radius = `calc(var(--extension-sidebar-floating-radius, ${theme.shape.radius.lg}) + ${outset})`;
  const lineBase = {
    content: '""',
    position: 'absolute' as const,
    boxSizing: 'border-box' as const,
    pointerEvents: 'none' as const,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create('border-color'),
    },
  };
  const lineStates = {
    '&:hover::before, &:active::before': {
      borderColor: theme.colors.accent.subtleBackground,
    },
    '&:focus-visible': {
      outline: 'none',
    },
    '&:focus-visible::before': {
      borderColor: theme.colors.accent.main,
    },
  };
  return {
    // A strip centred on the sidebar's top border, its full width, drawn as the width handle's left strip is: the
    // line tapers around the rounded corners, shows on hover and while resizing, and turns solid for keyboard focus.
    top: css({
      position: 'absolute',
      left: 0,
      right: 0,
      top: `calc(${hitArea} / -2)`,
      height: hitArea,
      zIndex: 1,
      cursor: 'row-resize',
      touchAction: 'none',
      '&::before': {
        ...lineBase,
        left: `calc(-1 * ${outset})`,
        right: `calc(-1 * ${outset})`,
        top: `calc(${hitArea} / 2 - ${outset})`,
        height: radius,
        borderTop: `${line} solid transparent`,
        borderTopLeftRadius: radius,
        borderTopRightRadius: radius,
      },
      ...lineStates,
    }),
    // A square centred on the top-left corner, above both edge strips. Its line follows the rounded corner only.
    corner: css({
      position: 'absolute',
      top: `calc(${hitArea} / -2)`,
      left: `calc(${hitArea} / -2)`,
      width: theme.spacing(2),
      height: theme.spacing(2),
      zIndex: 2,
      cursor: 'nwse-resize',
      touchAction: 'none',
      '&::before': {
        ...lineBase,
        top: `calc(${hitArea} / 2 - ${outset})`,
        left: `calc(${hitArea} / 2 - ${outset})`,
        width: radius,
        height: radius,
        borderTop: `${line} solid transparent`,
        borderLeft: `${line} solid transparent`,
        borderTopLeftRadius: radius,
      },
      ...lineStates,
    }),
  };
};
