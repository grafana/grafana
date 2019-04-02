import React from 'react';
import { RenderFunction } from '@storybook/react';
import { ThemeContext } from '../../themes/ThemeContext';
import { select } from '@storybook/addon-knobs';
import { getTheme } from '../../themes/index';
import { GrafanaThemeType } from '../../types';

type SassThemeChangeHandler = (theme: GrafanaThemeType) => void;
const ThemableStory: React.FunctionComponent<{ handleSassThemeChange: SassThemeChangeHandler }> = ({
  children,
  handleSassThemeChange,
}) => {
  const themeKnob = select(
    'Theme',
    {
      Light: GrafanaThemeType.Light,
      Dark: GrafanaThemeType.Dark,
    },
    GrafanaThemeType.Dark
  );

  handleSassThemeChange(themeKnob);

  return <ThemeContext.Provider value={getTheme(themeKnob)}>{children}</ThemeContext.Provider>;
};

// Temporary solution. When we update to Storybook V5 we will be able to pass data from decorator to story
// https://github.com/storybooks/storybook/issues/340#issuecomment-456013702
export const renderComponentWithTheme = (component: React.ComponentType<any>, props: any) => {
  return (
    <ThemeContext.Consumer>
      {theme => {
        return React.createElement(component, {
          ...props,
          theme,
        });
      }}
    </ThemeContext.Consumer>
  );
};

export const withTheme = (handleSassThemeChange: SassThemeChangeHandler) => (story: RenderFunction) => (
  <ThemableStory handleSassThemeChange={handleSassThemeChange}>{story()}</ThemableStory>
);
