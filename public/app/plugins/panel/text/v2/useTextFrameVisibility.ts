import { useLayoutEffect, useState, type RefObject } from 'react';

const PREFETCH_MARGIN = '1000px';
const DISPOSE_DELAY_MS = 5000;
const MOUNT_BATCH_SIZE = 4;

const listeners = new Map<Element, (visible: boolean) => void>();
const pending = new Set<() => void>();
let observer: IntersectionObserver | undefined;
let mountAnimationFrame: number | undefined;

function scheduleMount(callback: () => void) {
  pending.add(callback);
  mountAnimationFrame ??= window.requestAnimationFrame(mountBatch);
  return () => {
    pending.delete(callback);
    if (pending.size === 0) {
      if (mountAnimationFrame !== undefined) {
        window.cancelAnimationFrame(mountAnimationFrame);
      }
      mountAnimationFrame = undefined;
    }
  };
}

function mountBatch() {
  mountAnimationFrame = undefined;
  let count = 0;
  for (const callback of pending) {
    pending.delete(callback);
    callback();
    if (++count === MOUNT_BATCH_SIZE) {
      break;
    }
  }
  if (pending.size > 0) {
    mountAnimationFrame = window.requestAnimationFrame(mountBatch);
  }
}

/** Dashboard-only opt-in: callers keep fit-content, capture, and stateful content mounted. */
export function useTextFrameVisibility(host: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const supported = typeof IntersectionObserver !== 'undefined';
  const [mounted, setMounted] = useState(!enabled || !supported);

  useLayoutEffect(() => {
    const element = host.current;
    if (!enabled || !supported || !element) {
      return;
    }
    let disposed = false;
    let visible = false;
    let disposeTimer: number | undefined;
    let cancelMount: (() => void) | undefined;

    const disposeFrame = () => {
      if (disposed || visible) {
        return;
      }
      // The parent can see the focused iframe even when its document has an opaque origin.
      if (element.contains(document.activeElement)) {
        disposeTimer = window.setTimeout(disposeFrame, DISPOSE_DELAY_MS);
        return;
      }
      setMounted(false);
    };
    const onVisibility = (next: boolean) => {
      visible = next;
      clearTimeout(disposeTimer);
      cancelMount?.();
      if (visible) {
        cancelMount = scheduleMount(() => {
          if (!disposed && visible) {
            setMounted(true);
          }
        });
      } else {
        disposeTimer = window.setTimeout(disposeFrame, DISPOSE_DELAY_MS);
      }
    };

    observer ??= new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          listeners.get(entry.target)?.(entry.isIntersecting);
        }
      },
      // Dashboard scroll containers otherwise clip the viewport prefetch margin.
      { rootMargin: PREFETCH_MARGIN, scrollMargin: PREFETCH_MARGIN }
    );
    listeners.set(element, onVisibility);
    observer.observe(element);
    return () => {
      disposed = true;
      clearTimeout(disposeTimer);
      cancelMount?.();
      observer?.unobserve(element);
      listeners.delete(element);
      if (listeners.size === 0) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  }, [enabled, host, supported]);

  return !enabled || !supported || mounted;
}
