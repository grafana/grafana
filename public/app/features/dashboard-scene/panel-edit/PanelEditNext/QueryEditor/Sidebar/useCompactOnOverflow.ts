import { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface CompactOnOverflow {
  containerRef: React.RefObject<HTMLDivElement>;
  /** Must not shrink below its content (keep the flex default min-width: auto), or measurement breaks. */
  contentRef: React.RefObject<HTMLDivElement>;
  compact: boolean;
}

/**
 * Collapses content to a compact rendering when it no longer fits its container, driven by
 * measured overflow. The full content's width is remembered on collapse so expanding doesn't
 * oscillate. The content element is measured directly because the container's scrollWidth is
 * clamped to clientWidth when content fits — it can't report remaining slack.
 *
 * @param contentKey - changes whenever the rendered content changes, invalidating the
 * remembered width.
 */
export function useCompactOnOverflow(contentKey: string): CompactOnOverflow {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  // Width the full content needs, captured on collapse. `null` = full content rendered.
  const requiredFullWidthRef = useRef<number | null>(null);

  // Reads only refs so it stays referentially stable for the observer effect below.
  const evaluate = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;

    if (!container || !content) {
      return;
    }

    if (requiredFullWidthRef.current === null) {
      // Collapse once the full content no longer fits.
      if (content.offsetWidth > container.clientWidth) {
        requiredFullWidthRef.current = content.offsetWidth;
        setCompact(true);
      }
    } else if (container.clientWidth >= requiredFullWidthRef.current) {
      // Exact complement of the collapse condition, so no width fires both.
      requiredFullWidthRef.current = null;
      setCompact(false);
    }
  }, []);

  // Content changed: reset to the full rendering and re-measure from scratch.
  useLayoutEffect(() => {
    requiredFullWidthRef.current = null;
    setCompact(false);
  }, [contentKey]);

  // Re-check after every commit, pre-paint, so clipped content never flashes.
  useLayoutEffect(evaluate);

  // Cover container resizes that happen without a re-render (pane splitter drag, window resize).
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(evaluate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [evaluate]);

  return { containerRef, contentRef, compact };
}
