import { useEffect, useMemo, useState } from 'react';

import { ThemeBreakpointsKey } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

export function useMediaQueryMinWidth(breakpoint: ThemeBreakpointsKey): boolean {
  const theme = useTheme2();
  const mediaQuery = useMemo(
    () => window.matchMedia(`(min-width: ${theme.breakpoints.values[breakpoint]}px)`),
    [theme, breakpoint]
  );
  const [isMatch, setIsMatch] = useState(mediaQuery.matches);

  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setIsMatch(e.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [mediaQuery]);

  return isMatch;
}
