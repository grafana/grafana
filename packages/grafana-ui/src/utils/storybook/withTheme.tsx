import { Decorator } from '@storybook/react';
import * as React from 'react';

import { getThemeById, GrafanaTheme2, ThemeContext } from '@grafana/data';

import { GlobalStyles } from '../../themes/GlobalStyles/GlobalStyles';

type SassThemeChangeHandler = (theme: GrafanaTheme2) => void;
interface ThemeableStoryProps {
  themeId: string;
  handleSassThemeChange: SassThemeChangeHandler;
}
const ThemeableStory = ({ children, handleSassThemeChange, themeId }: React.PropsWithChildren<ThemeableStoryProps>) => {
  const theme = getThemeById(themeId);

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
  (story, context) => (
    <ThemeableStory themeId={context.globals.theme} handleSassThemeChange={handleSassThemeChange}>
      {story()}
    </ThemeableStory>
  );
