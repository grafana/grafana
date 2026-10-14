import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { type QueryCoauthoringGroupEvent, type QueryCoauthoringGroupLayout } from './queryCoauthoringGroupLayout';

const REST_WIDTH = 720;
const MARGIN = 8;
const MIN_WIDTH = 200;

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
  const [restWidth, setRestWidth] = useState<number>();
  const current = useRef({ isProposal, layout, restWidth });
  current.current = { isProposal, layout, restWidth };
  useLayoutEffect(() => {
    portalTarget.append(surfaceTarget);
    return () => surfaceTarget.remove();
  }, [portalTarget, surfaceTarget]);

  const frozen = layout !== undefined;
  // Set the proposal width before paint so the surface animates from the prompt width to the rest width.
  useLayoutEffect(() => {
    if (!isProposal) {
      setRestWidth(undefined);
      return;
    }
    if (frozen || current.current.restWidth !== undefined) {
      return;
    }
    const left = containerRef.current?.getBoundingClientRect().left ?? MARGIN;
    const available = window.innerWidth - Math.max(left, MARGIN) - MARGIN;
    setRestWidth(Math.max(Math.min(REST_WIDTH, available), Math.min(MIN_WIDTH, window.innerWidth - MARGIN * 2)));
  }, [containerRef, frozen, isProposal]);
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
      width: current.current.restWidth ?? (rect?.width || Math.min(423, window.innerWidth - 16)),
    };
  }, [containerRef]);
  const freeze = useCallback(
    (force = false) => {
      const { isProposal: proposal, layout: frozenLayout, restWidth: target } = current.current;
      if (!proposal || frozenLayout) {
        return;
      }
      const width = containerRef.current?.getBoundingClientRect().width;
      // Freezing moves the surface to the body, which cancels a running width transition.
      if (!force && target !== undefined && width && Math.abs(width - target) > 1) {
        return;
      }
      update({ type: 'group-layout-frozen', layout: readLayout(), bounds: readBounds() });
    },
    [containerRef, readBounds, readLayout, update]
  );

  useEffect(() => {
    if (!isProposal || frozen) {
      return;
    }
    const settle = setTimeout(() => freeze(), 160);
    const fallback = setTimeout(() => freeze(true), 600);
    return () => {
      clearTimeout(settle);
      clearTimeout(fallback);
    };
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
    restWidth,
    freeze,
    start(event: PointerEvent<HTMLDivElement>) {
      if (!current.current.isProposal || event.button !== 0 || !(event.target instanceof Element)) {
        return;
      }
      const edge = event.target.closest('[data-proposal-resize]')?.getAttribute('data-proposal-resize');
      // Drag only from the handle so text in the cards stays selectable.
      if (!edge && !event.target.closest('[data-proposal-drag-handle]')) {
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
