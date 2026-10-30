import { useEffect, useRef } from 'react';

export function useFilterInputFocus() {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The closing column menu restores its trigger focus before this popup takes over.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return inputRef;
}
