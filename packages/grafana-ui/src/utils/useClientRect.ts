import { useState, useCallback } from 'react';

export const useClientRect = <T extends HTMLElement>(): [{ width: number; height: number } | null, React.Ref<T>] => {
  const [node, setNode] = useState<T | null>(null);

  const ref = useCallback((node: T) => {
    if (node !== null) {
      setNode(node);
    }
  }, []);

  return [node && node.getBoundingClientRect(), ref];
};
