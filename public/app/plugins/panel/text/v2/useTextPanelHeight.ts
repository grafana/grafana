import { useLayoutEffect, useState } from 'react';

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
