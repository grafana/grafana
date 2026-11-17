import { type MouseEvent, type PointerEvent, useCallback, useEffect, useRef } from 'react';

const HOLD_DELAY_MS = 200;

export function useQueryCoauthoringChipPeek(onPeek?: (index: number) => void, onStopPeek?: () => void) {
  const callbacks = useRef({ onPeek, onStopPeek });
  callbacks.current = { onPeek, onStopPeek };
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const suppressClick = useRef(false);

  const stop = useCallback(() => {
    clearTimeout(pending.current);
    pending.current = undefined;
    if (held.current) {
      held.current = false;
      callbacks.current.onStopPeek?.();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('pointerup', stop, true);
    document.addEventListener('pointercancel', stop, true);
    window.addEventListener('blur', stop);
    return () => {
      document.removeEventListener('pointerup', stop, true);
      document.removeEventListener('pointercancel', stop, true);
      window.removeEventListener('blur', stop);
      stop();
    };
  }, [stop]);

  return {
    start(event: PointerEvent<HTMLButtonElement>, index: number) {
      if (event.button !== 0 || !callbacks.current.onPeek) {
        return;
      }
      stop();
      suppressClick.current = false;
      pending.current = setTimeout(() => {
        pending.current = undefined;
        held.current = true;
        suppressClick.current = true;
        callbacks.current.onPeek?.(index);
      }, HOLD_DELAY_MS);
    },
    stop,
    consumeClick(event: MouseEvent<HTMLButtonElement>) {
      if (suppressClick.current && event.detail > 0) {
        suppressClick.current = false;
        return true;
      }
      return false;
    },
  };
}
