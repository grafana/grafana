import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Measures a text element to determine if it is truncated. Can be used to selectively show a tooltip for truncated
 * text when needed.
 */
export function useBreadcrumbTruncation(text: string, isCurrent: boolean) {
  const breadcrumbRef = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  // Changing truncation adds or removes Tooltip, replacing the element attached to the ref.
  useLayoutEffect(() => {
    const element = breadcrumbRef.current;
    if (!element) {
      return;
    }

    const checkTruncation = () => {
      if (element.scrollWidth > element.clientWidth) {
        setIsTruncated(true);
        return;
      }

      // Integer widths can hide fractional overflow that still triggers CSS ellipsis.
      const range = document.createRange();
      range.selectNodeContents(element);
      setIsTruncated(range.getBoundingClientRect().width > element.getBoundingClientRect().width);
    };
    checkTruncation();

    const observer = new ResizeObserver(checkTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [
    text,
    isCurrent,
    // isTruncated is not used directly but allows for detecting when the element is removed from dom based on the
    // isTruncated state and stop watching for changes
    isTruncated,
  ]);

  return { breadcrumbRef, isTruncated };
}
