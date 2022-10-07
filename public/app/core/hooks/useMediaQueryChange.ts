import { useEffect } from 'react';

export function useMediaQueryChange({
  breakpoint,
  onChange,
  value,
}: {
  breakpoint: number;
  onChange: (e: MediaQueryListEvent) => void;
  value: boolean;
}) {
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onMediaQueryChange = (e: MediaQueryListEvent) => onChange(e);
    mediaQuery.addEventListener('change', onMediaQueryChange);

    return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
  }, [breakpoint, onChange, value]);
}
