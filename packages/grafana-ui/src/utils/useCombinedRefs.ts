import React from 'react';

export function useCombinedRefs<T>(...refs: any) {
  const targetRef = React.useRef<T>(null);

  React.useEffect(() => {
    refs.forEach((ref: any) => {
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
