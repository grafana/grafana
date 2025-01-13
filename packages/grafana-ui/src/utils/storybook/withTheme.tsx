import { Decorator } from '@storybook/react';
import * as React from 'react';
import { useDarkMode } from 'storybook-dark-mode';

import { createTheme, GrafanaTheme2, ThemeContext } from '@grafana/data';

import { GlobalStyles } from '../../themes/GlobalStyles/GlobalStyles';

type SassThemeChangeHandler = (theme: GrafanaTheme2) => void;
const ThemeableStory = ({
  children,
  handleSassThemeChange,
}: React.PropsWithChildren<{ handleSassThemeChange: SassThemeChangeHandler }>) => {
  const theme = createTheme({ colors: { mode: useDarkMode() ? 'dark' : 'light' } });

  handleSassThemeChange(theme);

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

      <style>{css}</style>
      {children}
    </ThemeContext.Provider>
  );
};

export const withTheme =
  (handleSassThemeChange: SassThemeChangeHandler): Decorator =>
  // eslint-disable-next-line react/display-name
  (story) => <ThemeableStory handleSassThemeChange={handleSassThemeChange}>{story()}</ThemeableStory>;
