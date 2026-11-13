import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { FeatureControlFlags } from './FeatureControlFlags';

type Position = { x: number; y: number };

const FEATURE_CONTROL_POSITION_LOCAL_STORAGE_KEY = 'grafana.feature-control.position';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Clamp a position so the panel stays within the viewport. When the panel is
// larger than the viewport the range becomes negative, letting it be dragged
// past the top/left edge so the far edge (e.g. the footer actions) stays
// reachable instead of being pinned off-screen.
const clampToViewport = ({ x, y }: Position, width: number, height: number): Position => ({
  x: clamp(x, Math.min(0, window.innerWidth - width), Math.max(0, window.innerWidth - width)),
  y: clamp(y, Math.min(0, window.innerHeight - height), Math.max(0, window.innerHeight - height)),
});

const parsePosition = (raw: string): Position | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {}

  return null;
};

// Rendered via LazyFeatureControlFloating, which owns the `isOpen` check.
export const FeatureControlFloating = () => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const ref = useRef<HTMLDivElement>(null);
  const [storedPosition, setStoredPosition] = useStoredString(FEATURE_CONTROL_POSITION_LOCAL_STORAGE_KEY, '');
  const [position, setPosition] = useState<Position | null>(() => parsePosition(storedPosition));

  // Keep a ref in sync so the resize/observer callbacks can read the latest position.
  const positionRef = useRef(position);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const onDragHandleDown = useCallback(
    (event: ReactPointerEvent) => {
      // Let the close button (and any other controls) keep their click behaviour.
      // Use Element (not HTMLElement) so clicks landing on an inner SVG icon are
      // still recognised as being inside a <button>.
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) {
        return;
      }

      const rect = ref.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      event.preventDefault();

      const startX = event.clientX;
      const startY = event.clientY;
      const originX = rect.left;
      const originY = rect.top;
      const { width, height } = rect;
      let latest: Position = { x: originX, y: originY };

      const onMove = (moveEvent: PointerEvent) => {
        latest = clampToViewport(
          { x: originX + (moveEvent.clientX - startX), y: originY + (moveEvent.clientY - startY) },
          width,
          height
        );
        setPosition(latest);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setStoredPosition(JSON.stringify(latest));
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [setStoredPosition]
  );

  // Re-clamp the panel into the viewport whenever it or the window resizes, so
  // growing (e.g. showing the suspended warning) or a smaller window can't push
  // it off-screen. Only applies once the panel has been moved from its default
  // bottom-right anchor.
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const reclamp = () => {
      const current = positionRef.current;
      if (!current) {
        return;
      }

      const rect = element.getBoundingClientRect();
      const next = clampToViewport(current, rect.width, rect.height);

      if (next.x !== current.x || next.y !== current.y) {
        setPosition(next);
        setStoredPosition(JSON.stringify(next));
      }
    };

    const observer = new ResizeObserver(reclamp);
    observer.observe(element);
    window.addEventListener('resize', reclamp);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reclamp);
    };
  }, [setStoredPosition]);

  return (
    <Portal zIndex={theme.zIndex.modal}>
      <div
        ref={ref}
        className={styles.portal}
        style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      >
        <FeatureControlFlags onDragHandleDown={onDragHandleDown} />
      </div>
    </Portal>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  portal: css({
    position: 'fixed',
    bottom: theme.spacing(3),
    right: theme.spacing(3),
  }),
});
