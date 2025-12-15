import React from 'react';

/**
 * Cannot use the react-use useClickAway directly as it relies on mousedown event which is not ideal as the element selection uses pointerdown
 * @param ref
 * @param onClickAway
 */
export function useCustomClickAway(onClickAway: (evt: MouseEvent | TouchEvent) => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  const refCb = React.useRef(onClickAway);

  React.useLayoutEffect(() => {
    refCb.current = onClickAway;
  });

  React.useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      const element = ref.current;
      if (element && e.target instanceof Node && !element.contains(e.target)) {
        refCb.current(e);
      }
    };

    document.addEventListener('pointerdown', handler);

    return () => {
      document.removeEventListener('pointerdown', handler);
    };
  }, []);

  return ref;
}
