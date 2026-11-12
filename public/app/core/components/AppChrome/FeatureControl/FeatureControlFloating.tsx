import { css } from '@emotion/css';
import { type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';

import type { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2, useTheme2 } from '@grafana/ui';
import { useStoredString } from 'app/core/hooks/useStored';

import { FeatureControlFlags } from './FeatureControlFlags';

type Position = { x: number; y: number };

const FEATURE_CONTROL_POSITION_LOCAL_STORAGE_KEY = 'grafana.feature-control.position';

// Keep at least this much of the panel on-screen so the drag handle stays reachable.
const VISIBLE_MARGIN = 32;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parsePosition = (raw: string): Position | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return {
        x: clamp(parsed.x, 0, Math.max(0, window.innerWidth - VISIBLE_MARGIN)),
        y: clamp(parsed.y, 0, Math.max(0, window.innerHeight - VISIBLE_MARGIN)),
      };
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
  const [dragPosition, setDragPosition] = useState<Position | null>(null);

  // Live drag state wins while dragging; otherwise fall back to the persisted value.
  const position = dragPosition ?? parsePosition(storedPosition);

  const onDragHandleDown = useCallback(
    (event: ReactPointerEvent) => {
      // Let the close button (and any other controls) keep their click behaviour.
      if (event.button !== 0 || (event.target instanceof HTMLElement && event.target.closest('button'))) {
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
        const maxX = Math.max(0, window.innerWidth - width);
        const maxY = Math.max(0, window.innerHeight - height);
        latest = {
          x: clamp(originX + (moveEvent.clientX - startX), 0, maxX),
          y: clamp(originY + (moveEvent.clientY - startY), 0, maxY),
        };
        setDragPosition(latest);
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
