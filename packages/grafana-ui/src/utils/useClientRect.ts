import { useState, useCallback } from 'react';

export const useClientRect = <T extends HTMLElement>(): [{ width: number; height: number } | null, React.Ref<T>] => {
  const [rect, setRect] = useState<{ width: number; height: number } | null>(null);
  const ref = useCallback((node: T) => {
    if (node !== null) {
      setRect(node.getBoundingClientRect());
    }
  }, []);
  return [rect, ref];
};
