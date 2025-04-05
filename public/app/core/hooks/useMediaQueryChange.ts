import { useEffect, useMemo, useState } from 'react';

export function useMediaQueryChange({
  breakpoint,
  onChange,
}: {
  breakpoint: number;
  onChange: (e: MediaQueryListEvent) => void;
}) {
  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const onMediaQueryChange = (e: MediaQueryListEvent) => onChange(e);
    mediaQuery.addEventListener('change', onMediaQueryChange);

    return () => mediaQuery.removeEventListener('change', onMediaQueryChange);
  }, [breakpoint, onChange]);
}

export function useMediaQuery(query: string): boolean {
  const mediaQuery = useMemo(() => window.matchMedia(query), [query]);
  const [isMatch, setIsMatch] = useState(mediaQuery.matches);

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setIsMatch(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [mediaQuery]);

  return isMatch;
}
