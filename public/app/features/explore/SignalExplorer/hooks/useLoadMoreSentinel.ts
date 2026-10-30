import { useEffect, useRef, useState } from 'react';

/**
 * Calls `onVisible` whenever the element given the returned ref scrolls into view, for a list that
 * grows as its end is reached.
 *
 * `rearmKey` is whatever changes when a batch is added (the visible count). An observer only reports
 * changes, so a sentinel still in view after a batch lands would never fire again and leave the space
 * below it empty. A fresh observer reports the current state once, which keeps filling that space
 * until the sentinel is pushed out of view.
 *
 * The root is the viewport, not a particular scroller: intersection is still clipped by every
 * scrolling ancestor, so this holds whichever of them ends up scrolling the list.
 */
export function useLoadMoreSentinel(onVisible: () => void, rearmKey: unknown): (element: HTMLElement | null) => void {
  // State rather than a ref object: the sentinel mounts only while there is more to load, and its
  // arrival has to rerun the effect below.
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      // A focused sentinel is a control the user is about to activate: tabbing to it scrolls it into
      // view, and loading then would move it out from under them.
      if (entries.some((entry) => entry.isIntersecting) && document.activeElement !== sentinel) {
        onVisibleRef.current();
      }
    });
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [sentinel, rearmKey]);

  return setSentinel;
}
