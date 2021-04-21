import React from 'react';
import { ThemeContext } from '../../themes/ThemeContext';
import { createTheme, GrafanaThemeV2 } from '@grafana/data';
import { RenderFunction } from '../../types';
import { useDarkMode } from 'storybook-dark-mode';

type SassThemeChangeHandler = (theme: GrafanaThemeV2) => void;
const ThemeableStory: React.FunctionComponent<{ handleSassThemeChange: SassThemeChangeHandler }> = ({
  children,
  handleSassThemeChange,
}) => {
  const theme = createTheme({ palette: { mode: useDarkMode() ? 'dark' : 'light' } });

  handleSassThemeChange(theme);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
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
export const withTheme = (handleSassThemeChange: SassThemeChangeHandler) => (story: RenderFunction) => (
  <ThemeableStory handleSassThemeChange={handleSassThemeChange}>{story()}</ThemeableStory>
);
