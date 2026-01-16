import { Decorator } from '@storybook/react';
import { useEffect } from 'react';
import * as React from 'react';

import { createTheme, getThemeById, ThemeContext } from '@grafana/data';
import { GlobalStyles, PortalContainer } from '@grafana/ui';

interface ThemeableStoryProps {
  themeId?: string;
}
const ThemeableStory = ({ children, themeId }: React.PropsWithChildren<ThemeableStoryProps>) => {
  // Always ensure we have a valid theme
  const theme = React.useMemo(() => {
    const id = themeId || 'dark';
    let resolvedTheme = getThemeById(id);

    // If getThemeById returns undefined, create a default theme
    if (!resolvedTheme) {
      console.warn(`Theme '${id}' not found, using default theme`);
      resolvedTheme = createTheme({ colors: { mode: id === 'light' ? 'light' : 'dark' } });
    }

    console.log('withTheme: resolved theme', { id, hasTheme: !!resolvedTheme, hasSpacing: !!resolvedTheme?.spacing });
    return resolvedTheme;
  }, [themeId]);

  // Apply theme to document root for Portals
  useEffect(() => {
    if (!theme) {
      return;
    }

    document.body.style.setProperty('--theme-background', theme.colors.background.primary);
  }, [theme]);

  if (!theme) {
    console.error('withTheme: No theme available!');
    return null;
  }

  const css = `
  #storybook-root {
    padding: ${theme.spacing(2)};
  }

  body {
    background: ${theme.colors.background.primary};
  }
  `;

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <PortalContainer />

      <style>{css}</style>
      {children}
    </ThemeContext.Provider>
  );
};

export const withTheme =
  (): Decorator =>
  // eslint-disable-next-line react/display-name
  (story, context) => <ThemeableStory themeId={context.globals?.theme}>{story()}</ThemeableStory>;
