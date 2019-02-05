import React from 'react';
import { RenderFunction } from '@storybook/react';
import { ThemeContext } from '../../themes/ThemeContext';
import { select } from '@storybook/addon-knobs';
import { getTheme } from '../../themes';
import { GrafanaThemeType } from '../../types';

const ThemableStory: React.FunctionComponent<{}> = ({ children }) => {
  const themeKnob = select(
    'Theme',
    {
      Default: GrafanaThemeType.Dark,
      Light: GrafanaThemeType.Light,
      Dark: GrafanaThemeType.Dark,
    },
    GrafanaThemeType.Dark
  );

  return (
    <ThemeContext.Provider value={getTheme(themeKnob)}>
      {children}
    </ThemeContext.Provider>

  );
};

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

export const withTheme = (story: RenderFunction) => <ThemableStory>{story()}</ThemableStory>;
