import { useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';

export const FLOATING_SIDEBAR_MIN_HEIGHT = 48;

export function useFloatingSidebar(getParkAnchor: (() => HTMLElement | null) | undefined, hasOpenPane: boolean) {
  const [isFloating, setIsFloating] = useState(false);
  const [isParked, setIsParked] = useState(false);
  const [bounds, setBounds] = useState({ x: 16, y: 16, width: 440, height: 560 });
  const expandedSize = useRef({ width: 440, height: 560 });
  const drag = useRef<{ x: number; y: number; bounds: typeof bounds; resize: boolean } | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const isMinimized = !hasOpenPane || bounds.height <= FLOATING_SIDEBAR_MIN_HEIGHT;
  const displayedBounds = hasOpenPane
    ? bounds
    : { ...bounds, width: Math.min(320, window.innerWidth), height: FLOATING_SIDEBAR_MIN_HEIGHT };

  function constrain(next: typeof bounds) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nextWidth = Math.min(Math.max(320, next.width), width);
    const nextHeight = Math.min(Math.max(FLOATING_SIDEBAR_MIN_HEIGHT, next.height), height);
    return {
      x: Math.max(0, Math.min(next.x, width - (hasOpenPane ? nextWidth : Math.min(320, width)))),
      y: Math.max(0, Math.min(next.y, height - (hasOpenPane ? nextHeight : FLOATING_SIDEBAR_MIN_HEIGHT))),
      width: nextWidth,
      height: nextHeight,
    };
  }

  function parkedBounds(value: typeof bounds) {
    const target = getParkAnchor?.()?.getBoundingClientRect();
    const anchor = anchorRef.current?.getBoundingClientRect();
    const width = hasOpenPane ? value.width : 320;
    return constrain({
      ...value,
      x: (target?.left ?? anchor?.left ?? window.innerWidth - 64) - width - 8,
      y: target ? target.top + (target.height - FLOATING_SIDEBAR_MIN_HEIGHT) / 2 : (anchor?.top ?? 0),
    });
  }

  function start(event: PointerEvent<HTMLElement>, resize = false) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, bounds, resize };
    setIsParked(false);
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!drag.current) {
      return;
    }
    const { x, y, bounds: initial, resize } = drag.current;
    const dx = event.clientX - x;
    const dy = event.clientY - y;
    setBounds(
      constrain(
        resize
          ? { ...initial, width: initial.width + dx, height: initial.height + dy }
          : { ...initial, x: initial.x + dx, y: initial.y + dy }
      )
    );
  }

  function keyboard(event: KeyboardEvent<HTMLElement>, resize = false) {
    const delta = event.shiftKey ? 40 : 10;
    const dx = event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0;
    const dy = event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0;
    if (!dx && !dy) {
      return;
    }
    event.preventDefault();
    setIsParked(false);
    setBounds(
      constrain(
        resize
          ? { ...bounds, width: bounds.width + dx, height: bounds.height + dy }
          : { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
      )
    );
  }

  function minimize() {
    if (!isMinimized) {
      expandedSize.current = { width: bounds.width, height: bounds.height };
    }
    setBounds(constrain({ ...bounds, height: FLOATING_SIDEBAR_MIN_HEIGHT }));
  }

  return {
    isFloating,
    isParked,
    isMinimized,
    bounds: displayedBounds,
    containerRef,
    anchorRef,
    toggle: () => {
      if (!isFloating) {
        const rect = containerRef.current?.getBoundingClientRect();
        const anchor = anchorRef.current?.getBoundingClientRect();
        setBounds(
          constrain({
            ...bounds,
            x: (rect?.right || window.innerWidth - 72) - bounds.width,
            y: anchor?.top || 16,
          })
        );
      }
      setIsFloating(!isFloating);
      setIsParked(false);
    },
    fit: () => setBounds((value) => (isParked ? parkedBounds(value) : constrain(value))),
    toggleMinimized: () => {
      if (isMinimized) {
        setIsParked(false);
        setBounds(constrain({ ...bounds, ...expandedSize.current }));
      } else {
        minimize();
      }
    },
    park: () => {
      minimize();
      setBounds((value) => parkedBounds(value));
      setIsParked(true);
    },
    dragProps: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => start(event),
      onPointerMove: move,
      onPointerUp: () => {
        drag.current = undefined;
      },
      onPointerCancel: () => {
        drag.current = undefined;
      },
      onLostPointerCapture: () => {
        drag.current = undefined;
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event),
    },
    resizeProps: {
      onPointerDown: (event: PointerEvent<HTMLElement>) => start(event, true),
      onPointerMove: move,
      onPointerUp: () => {
        drag.current = undefined;
      },
      onPointerCancel: () => {
        drag.current = undefined;
      },
      onLostPointerCapture: () => {
        drag.current = undefined;
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, true),
    },
  };
}
