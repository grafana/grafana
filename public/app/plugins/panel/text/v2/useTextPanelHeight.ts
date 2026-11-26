import { useLayoutEffect, useState } from 'react';

/**
 * Measures the panel container height used to set the Text iframe's minimum height.
 * Unlike a general size hook, width-only changes do not update React state or rerender content:
 * CSS already resizes the iframe, whose runtime reports any resulting content-height changes.
 * Observe the panel's own container so the iframe's height cannot feed back into this measurement.
 */
export function useTextPanelHeight() {
  const [element, ref] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    let disposed = false;
    let lastHeight: number | undefined;
    const observer = new ResizeObserver((entries) => {
      const nextHeight = entries[0]?.contentRect.height;
      // Width changes still resize the iframe through CSS, but do not change its minimum height.
      if (!disposed && nextHeight !== undefined && nextHeight !== lastHeight) {
        lastHeight = nextHeight;
        setHeight(nextHeight);
      }
    });
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [element]);

  return [ref, height] as const;
}
