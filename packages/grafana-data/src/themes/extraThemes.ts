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
    case 'dark':
    default:
      return createTheme({ colors: { mode: 'dark' } });
  }
}

function createMidnight(): GrafanaTheme2 {
  return createTheme({
    name: 'Midnight',
    colors: {
      mode: 'dark',
      background: {
        canvas: '#000000',
        primary: '#000000',
        secondary: '#181818',
      },
    },
  });
}
