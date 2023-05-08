import { createTheme } from './createTheme';
import { GrafanaTheme2 } from './types';

/**
 * @internal
 * Only for internal use, never use this from a plugin
 **/
export function getThemeById(id: string): GrafanaTheme2 {
  if (id === 'system') {
    const mediaResult = window.matchMedia('(prefers-color-scheme: dark)');
    id = mediaResult.matches ? 'dark' : 'light';
  }

  switch (id) {
    case 'light':
      return createTheme({ colors: { mode: 'light' } });
    case 'midnight':
      return createMidnight();
    case 'blue-night':
      return createBlueNight();
    case 'dark':
    default:
      return createTheme({ colors: { mode: 'dark' } });
  }
}

/**
 * Just a temporary placeholder for a possible new theme
 */
function createMidnight(): GrafanaTheme2 {
  const whiteBase = '204, 204, 220';

  return createTheme({
    name: 'Midnight',
    colors: {
      mode: 'dark',
      background: {
        canvas: '#000000',
        primary: '#000000',
        secondary: '#181818',
      },
      border: {
        weak: `rgba(${whiteBase}, 0.17)`,
        medium: `rgba(${whiteBase}, 0.25)`,
        strong: `rgba(${whiteBase}, 0.35)`,
      },
    },
  });
}

/**
 * Just a temporary placeholder for a possible new theme
 */
function createBlueNight(): GrafanaTheme2 {
  return createTheme({
    name: 'Blue night',
    colors: {
      mode: 'dark',
      background: {
        canvas: '#15161d',
        primary: '#15161d',
        secondary: '#1d1f2e',
      },
      border: {
        weak: `#2e304f`,
        medium: `#2e304f`,
        strong: `#2e304f`,
      },
    },
  });
}
