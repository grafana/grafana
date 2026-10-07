import { type PointerEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import { type QueryCoauthoringGroupEvent, type QueryCoauthoringGroupLayout } from './queryCoauthoringGroupLayout';

export function useQueryCoauthoringGroup({
  portalTarget,
  containerRef,
  isProposal,
  layout,
  update,
}: {
  portalTarget: HTMLElement;
  containerRef: RefObject<HTMLDivElement | null>;
  isProposal: boolean;
  layout?: QueryCoauthoringGroupLayout;
  update(event: QueryCoauthoringGroupEvent): void;
}) {
  const surfaceTarget = useMemo(() => document.createElement('div'), []);
  const current = useRef({ isProposal, layout });
  current.current = { isProposal, layout };
  useLayoutEffect(() => {
    portalTarget.append(surfaceTarget);
    return () => surfaceTarget.remove();
  }, [portalTarget, surfaceTarget]);

  const frozen = layout !== undefined;
  useLayoutEffect(() => {
    if (!frozen) {
      return;
    }
    const active = document.activeElement;
    // Monaco can transform and bottom-anchor the host. Move the same portal node
    // outside that containing block without remounting the cards or their controls.
    document.body.append(surfaceTarget);
    if (active instanceof HTMLElement && surfaceTarget.contains(active)) {
      active.focus({ preventScroll: true });
    }
  }, [frozen, surfaceTarget]);

  const readBounds = useCallback(
    () => ({
      width: window.innerWidth,
      height: window.innerHeight,
      groupHeight: containerRef.current?.getBoundingClientRect().height ?? 0,
    }),
    [containerRef]
  );
  const readLayout = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      left: rect?.left ?? 8,
      top: rect?.top ?? 8,
      width: rect?.width || Math.min(423, window.innerWidth - 16),
    };
  }, [containerRef]);
  const freeze = useCallback(() => {
    if (current.current.isProposal && !current.current.layout) {
      update({ type: 'group-layout-frozen', layout: readLayout(), bounds: readBounds() });
    }
  }, [readBounds, readLayout, update]);

  useEffect(() => {
    if (!isProposal || frozen) {
      return;
    }
    const settle = setTimeout(freeze, 160);
    return () => clearTimeout(settle);
  }, [freeze, frozen, isProposal]);

  useEffect(() => {
    const move = (event: globalThis.PointerEvent) => {
      update({
        type: 'group-pointer-moved',
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        bounds: readBounds(),
      });
    };
    const end = () => update({ type: 'group-pointer-ended' });
    const resize = () => update({ type: 'group-viewport-changed', bounds: readBounds() });
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', end, true);
      document.removeEventListener('pointercancel', end, true);
      window.removeEventListener('blur', end);
      window.removeEventListener('resize', resize);
    };
  }, [readBounds, update]);

  return {
    surfaceTarget,
    freeze,
    start(event: PointerEvent<HTMLDivElement>) {
      if (!current.current.isProposal || event.button !== 0 || !(event.target instanceof Element)) {
        return;
      }
      const edge = event.target.closest('[data-proposal-resize]')?.getAttribute('data-proposal-resize');
      if (
        !edge &&
        event.target.closest('button, a, input, textarea, select, [role="button"], [role="tab"], [data-no-drag]')
      ) {
        return;
      }
      event.preventDefault();
      update({
        type: 'group-pointer-started',
        gesture: {
          kind: edge === 'left' ? 'resize-left' : edge === 'right' ? 'resize-right' : 'drag',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        },
        layout: readLayout(),
        bounds: readBounds(),
      });
    },
  };
}
