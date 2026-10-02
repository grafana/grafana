/**
 * How long the layout must stay quiet (no resizes) before the pinned element is considered
 * settled. Exported for tests.
 */
export const SCROLL_PIN_SETTLE_MS = 1500;

/**
 * Scrolls an element into view and keeps it pinned there while surrounding content finishes
 * loading. A single scroll is not enough when siblings render asynchronously (e.g. query rows
 * loading their datasource editors): content above the element grows after the scroll and pushes
 * it away, leaving the viewport at a stale offset.
 *
 * Re-pinning is driven by a ResizeObserver on the element's parent and ends — calling `onDone` —
 * once the layout has been quiet for a settle window, or immediately on the first user scroll
 * gesture, so we never fight deliberate navigation.
 *
 * Returns a cancel function that stops pinning without calling `onDone` (for unmount).
 */
export function pinScrollIntoView(element: HTMLElement, onDone?: () => void): () => void {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let resizeObserver: ResizeObserver | undefined;

  const stop = () => {
    clearTimeout(settleTimer);
    resizeObserver?.disconnect();
    window.removeEventListener('wheel', onUserScroll);
    window.removeEventListener('touchmove', onUserScroll);
  };

  const finish = () => {
    stop();
    onDone?.();
  };

  // User-intent events only — not 'scroll', which our own programmatic scrolls would trigger.
  const onUserScroll = () => finish();

  const restartSettleTimer = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(finish, SCROLL_PIN_SETTLE_MS);
  };

  restartSettleTimer();

  const content = element.parentElement;
  if (content && typeof ResizeObserver !== 'undefined') {
    // Re-pin only on actual height changes, comparing against the height measured at pin start.
    // ResizeObserver reports an initial observation right after observe(): when content already
    // grew in that same frame (cached editors loading instantly on a re-add), the comparison lets
    // that first callback correct the scroll; otherwise it's a no-op that leaves the animation
    // alone.
    let lastHeight = content.getBoundingClientRect().height;
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (height === lastHeight) {
        return;
      }
      lastHeight = height;
      // Smooth re-pins re-target the in-flight animation from the current position, so the
      // navigation stays one continuous glide chasing the row instead of jump-cutting to it.
      // The chase may briefly lag behind fast growth, but the settle window bounds it and the
      // last re-pin always lands on the final position.
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      restartSettleTimer();
    });
    resizeObserver.observe(content);
  }

  window.addEventListener('wheel', onUserScroll, { passive: true });
  window.addEventListener('touchmove', onUserScroll, { passive: true });

  return stop;
}
