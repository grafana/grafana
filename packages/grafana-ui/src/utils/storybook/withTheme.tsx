import { type Decorator } from '@storybook/react';
import * as React from 'react';

import { getThemeById, type GrafanaTheme2, ThemeContext } from '@grafana/data';

import { GlobalStyles } from '../../themes/GlobalStyles/GlobalStyles';

import { applyVisualRefreshSetting, type VisualRefreshSetting } from './visualRefresh';

type SassThemeChangeHandler = (theme: GrafanaTheme2) => void;
interface ThemeableStoryProps {
  themeId: string;
  visualRefresh?: VisualRefreshSetting;
  handleSassThemeChange: SassThemeChangeHandler;
}
const ThemeableStory = ({
  children,
  handleSassThemeChange,
  themeId,
  visualRefresh,
}: React.PropsWithChildren<ThemeableStoryProps>) => {
  const theme = applyVisualRefreshSetting(getThemeById(themeId), visualRefresh);

  handleSassThemeChange(theme);

  const css = `
  #storybook-root {
    padding: ${theme.spacing(2)};
  }

  body {
    background: ${theme.colors.background.page};
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
    <ThemeableStory
      themeId={context.globals.theme}
      visualRefresh={context.globals.visualRefresh}
      handleSassThemeChange={handleSassThemeChange}
    >
      {story()}
    </ThemeableStory>
  );
