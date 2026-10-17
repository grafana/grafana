import { memo } from 'react';
import type * as React from 'react';

import { t } from '@grafana/i18n';

import { useTilingInternals } from './internalContext';
import { type SplitDivider } from './model/geometry';

/** Width of the grab area around the gap between two panels. */
const HIT_SIZE = 10;
const KEY_STEP = 10;
const KEY_STEP_LARGE = 50;

export interface DividerProps {
  divider: SplitDivider;
  active: boolean;
  onResizeStart: (e: React.PointerEvent, divider: SplitDivider) => void;
  onResizeBy: (divider: SplitDivider, delta: number) => void;
  onEven: (divider: SplitDivider) => void;
}

export const Divider = memo(function Divider({ divider, active, onResizeStart, onResizeBy, onEven }: DividerProps) {
  const { styles } = useTilingInternals();
  const { rect, axis } = divider;
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
      onResizeBy(divider, e.key === forward ? step : -step);
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
      data-tiling-divider={`${divider.splitId}:${divider.index}`}
      style={style}
      onPointerDown={(e) => onResizeStart(e, divider)}
      onDoubleClick={() => onEven(divider)}
      onKeyDown={onKeyDown}
    />
  );
});
