import { type Decorator } from '@storybook/react';
import * as React from 'react';

import { getThemeById, ThemeContext } from '@grafana/data/themes';
import { GlobalStyles } from '@grafana/ui/themes';

interface ThemeableStoryProps {
  themeId: string;
}
const ThemeableStory = ({ children, themeId }: React.PropsWithChildren<ThemeableStoryProps>) => {
  const theme = getThemeById(themeId);

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
  (): Decorator =>
  // eslint-disable-next-line react/display-name
  (story, context) => <ThemeableStory themeId={context.globals.theme}>{story()}</ThemeableStory>;
