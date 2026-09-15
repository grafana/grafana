import { keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

const shimmer = keyframes({
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
});

/**
 * Marks something as waiting for data. Shared so that the flame graph's loading bars and the call tree's loading rows
 * read as the same state.
 */
export function loadingShimmer(theme: GrafanaTheme2) {
  return {
    backgroundImage: `linear-gradient(90deg, transparent 35%, ${
      theme.isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.5)'
    } 50%, transparent 65%)`,
    backgroundSize: '200% 100%',
    [theme.transitions.handleMotion('no-preference')]: {
      animation: `${shimmer} 1.2s linear infinite`,
    },
  };
}
