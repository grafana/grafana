import { css } from '@emotion/css';
import { type KeyboardEvent, type PointerEvent, useRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import {
  DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH,
  MAX_EXTENSION_SIDEBAR_WIDTH,
  MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH,
} from './constants';

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

function clampWidth(width: number): number {
  return Math.round(Math.min(MAX_EXTENSION_SIDEBAR_WIDTH, Math.max(MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH, width)));
}

function reportResized(method: 'drag' | 'keyboard' | 'reset', width: number): void {
  reportInteraction('grafana_extension_sidebar_floating_resized', { method, width });
}

interface FloatingWidthHandleProps {
  width: number;
  onWidthChange: (width: number) => void;
}

/**
 * The floating sidebar's left edge, which resizes its width. The container is anchored to the right, so dragging
 * left widens it; arrow keys step it, and Home or a double-click goes back to the default. It sits inside the
 * moved wrapper, so it follows the sidebar wherever it was dragged.
 */
export function FloatingWidthHandle({ width, onWidthChange }: FloatingWidthHandleProps) {
  const styles = useStyles2(getStyles);
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number; width: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // The rendered width, which a narrow window may hold below the stored one.
    const startWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? width;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth, width: startWidth };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    active.width = clampWidth(active.startWidth + (active.startX - event.clientX));
    onWidthChange(active.width);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (active.width !== active.startWidth) {
      reportResized('drag', active.width);
    }
  };

  const reset = () => {
    onWidthChange(DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
    reportResized('reset', DEFAULT_FLOATING_EXTENSION_SIDEBAR_WIDTH);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = clampWidth(width + (event.key === 'ArrowLeft' ? step : -step));
      onWidthChange(next);
      reportResized('keyboard', next);
    } else if (event.key === 'Home') {
      event.preventDefault();
      reset();
    }
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focusable separator is the ARIA window splitter pattern
    <div
      role="separator"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- as above
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('navigation.extension-sidebar.floating-resize', 'Resize sidebar width')}
      aria-valuenow={width}
      aria-valuemin={MIN_FLOATING_EXTENSION_SIDEBAR_WIDTH}
      aria-valuemax={MAX_EXTENSION_SIDEBAR_WIDTH}
      className={styles.handle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      data-testid="extension-sidebar-floating-width-handle"
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const hitArea = theme.spacing(1);
  const line = '3px';
  // The line straddles the sidebar's 1px border, so its outer edge sits this far outside the sidebar's.
  const outset = `(${line} - 1px) / 2`;
  const radius = `calc(var(--extension-sidebar-floating-radius, ${theme.shape.radius.lg}) + ${outset})`;
  return {
    // A strip centred on the sidebar's left border, its full height. Its line, the docked handle's colour, tapers
    // around the rounded corners. It shows on hover and while resizing, and turns solid for keyboard focus: a ring
    // around a strip this thin reads as a box.
    handle: css({
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: `calc(${hitArea} / -2)`,
      width: hitArea,
      zIndex: 1,
      cursor: 'col-resize',
      touchAction: 'none',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: `calc(-1 * ${outset})`,
        bottom: `calc(-1 * ${outset})`,
        left: `calc(${hitArea} / 2 - ${outset})`,
        width: radius,
        boxSizing: 'border-box',
        // Only the left edge has a border, so the corners taper it to nothing along the top and bottom.
        borderLeft: `${line} solid transparent`,
        borderTopLeftRadius: radius,
        borderBottomLeftRadius: radius,
        pointerEvents: 'none',
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          transition: theme.transitions.create('border-color'),
        },
      },
      '&:hover::before, &:active::before': {
        borderColor: theme.colors.accent.subtleBackground,
      },
      '&:focus-visible': {
        outline: 'none',
      },
      '&:focus-visible::before': {
        borderColor: theme.colors.accent.main,
      },
    }),
  };
};
