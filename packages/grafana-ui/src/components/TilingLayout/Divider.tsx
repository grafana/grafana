import { memo } from 'react';
import type * as React from 'react';

import { t } from '@grafana/i18n';

import { useTilingInternals } from './internalContext';
import { type Seam } from './model/layout';

/** Width of the grab area around the gap between two panels. */
const HIT_SIZE = 10;
const KEY_STEP = 10;
const KEY_STEP_LARGE = 50;

export interface DividerProps {
  seam: Seam;
  active: boolean;
  onResizeStart: (e: React.PointerEvent, seam: Seam) => void;
  onResizeBy: (seam: Seam, delta: number) => void;
  onEven: (seam: Seam) => void;
}

export const Divider = memo(function Divider({ seam, active, onResizeStart, onResizeBy, onEven }: DividerProps) {
  const { styles } = useTilingInternals();
  const { rect, axis } = seam;
  const style: React.CSSProperties =
    axis === 'x'
      ? { left: rect.x + rect.w / 2 - HIT_SIZE / 2, top: rect.y, width: HIT_SIZE, height: rect.h }
      : { left: rect.x, top: rect.y + rect.h / 2 - HIT_SIZE / 2, width: rect.w, height: HIT_SIZE };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
    const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown';
    if (e.key === back || e.key === forward) {
      e.preventDefault();
      onResizeBy(seam, e.key === forward ? step : -step);
    }
  };

  return (
    // A focusable separator is the ARIA pattern for a splitter.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="separator"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={t('grafana-ui.tiling-layout.divider', 'Resize panels')}
      className={styles.divider}
      data-active={active || undefined}
      data-tiling-divider={`${seam.splitId}:${seam.index}`}
      style={style}
      onPointerDown={(e) => onResizeStart(e, seam)}
      onDoubleClick={() => onEven(seam)}
      onKeyDown={onKeyDown}
    />
  );
});
