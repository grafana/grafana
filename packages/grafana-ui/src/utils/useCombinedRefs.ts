import React from 'react';

export function useCombinedRefs<T>(
  ...refs: Array<React.MutableRefObject<T | null> | React.ForwardedRef<T | null> | ((instance: T | null) => void)>
) {
  const targetRef = React.useRef<T | null>(null);

  React.useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === 'function') {
        ref(targetRef.current);
      } else {
        ref.current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
}
