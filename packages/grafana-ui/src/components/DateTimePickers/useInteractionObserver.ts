import { useEffect, useMemo, useState } from 'react';

export default (ref: React.RefObject<HTMLDivElement>) => {
  const [entry, setEntry] = useState<IntersectionObserverEntry | undefined>();

  const observer = useMemo(
    () =>
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setEntry(entry);
          }
        });
      }),
    []
  );

  useEffect(() => {
    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref, observer]);

  return entry;
};

const isIntersectingLeft = (entry: IntersectionObserverEntry) => {
  const offset = getLeftOffset(entry);

  return offset < 0;
};

const isIntersectingRight = (entry: IntersectionObserverEntry) => {
  const offset = getRightOffset(entry);

  return offset < 0;
};

export const getRightOffset = ({ rootBounds, boundingClientRect }: IntersectionObserverEntry) =>
  (rootBounds?.right ?? 0) - boundingClientRect.right;

export const getLeftOffset = ({ rootBounds, boundingClientRect, intersectionRatio }: IntersectionObserverEntry) =>
  (rootBounds?.left ?? 0) + boundingClientRect.left;

export const getHorizontalOffset = (entry?: IntersectionObserverEntry) => {
  if (!entry) {
    return 0;
  }
  const intersectingLeft = isIntersectingLeft(entry);
  const intersectingRight = isIntersectingRight(entry);

  if (!intersectingLeft && !intersectingRight) {
    return 0;
  }

  if (intersectingLeft && intersectingRight) {
    return 0;
  }

  if (intersectingLeft) {
    return getLeftOffset(entry);
  }

  return getRightOffset(entry);
};
