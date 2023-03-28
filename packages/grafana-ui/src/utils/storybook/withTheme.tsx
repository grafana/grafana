import React from 'react';
import { useDarkMode } from 'storybook-dark-mode';

import { createTheme, GrafanaTheme2 } from '@grafana/data';

import { GlobalStyles } from '../../themes/GlobalStyles/GlobalStyles';
import { ThemeContext } from '../../themes/ThemeContext';
import { RenderFunction } from '../../types';

type SassThemeChangeHandler = (theme: GrafanaTheme2) => void;
const ThemeableStory: React.FunctionComponent<{ handleSassThemeChange: SassThemeChangeHandler }> = ({
  children,
  handleSassThemeChange,
}) => {
  const theme = createTheme({ colors: { mode: useDarkMode() ? 'dark' : 'light' } });

  handleSassThemeChange(theme);

  const css = `#root {
    width: 100%;
    padding: 20px;
    display: flex;
    height: 100%;
    min-height: 100%;
    background: ${theme.colors.background.primary};
  }`;

  return (
    <ThemeContext.Provider value={theme}>
      <GlobalStyles />
      <style>{css}</style>
      {children}
    </ThemeContext.Provider>
  );
};

// Temporary solution. When we update to Storybook V5 we will be able to pass data from decorator to story
// https://github.com/storybooks/storybook/issues/340#issuecomment-456013702
export const renderComponentWithTheme = (component: React.ComponentType<any>, props: any) => {
  return (
    <ThemeContext.Consumer>
      {(theme) => {
        return React.createElement(component, {
          ...props,
          theme,
        });
      }}
    </ThemeContext.Consumer>
  );
};

// eslint-disable-next-line react/display-name
export const withTheme = (handleSassThemeChange: SassThemeChangeHandler) => (story: RenderFunction) =>
  <ThemeableStory handleSassThemeChange={handleSassThemeChange}>{story()}</ThemeableStory>;
