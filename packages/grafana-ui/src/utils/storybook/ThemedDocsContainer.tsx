// Wrap the DocsContainer for theme switching support.
import { DocsContainer, type DocsContextProps } from '@storybook/addon-docs/blocks';
import * as React from 'react';

import { getThemeById, ThemeContext } from '@grafana/data';

import { createStorybookTheme } from '../../../.storybook/storybookTheme';
import { GlobalStyles } from '../../themes/GlobalStyles/GlobalStyles';

import { applyVisualRefreshSetting } from './visualRefresh';

type Props = {
  context: DocsContextProps;
  children?: React.ReactNode;
};

export const ThemedDocsContainer = ({ children, context }: Props) => {
  // Default to system theme for pages that don't have associated stories
  // Currently this is only the case for the docs `Intro` page
  let themeId = 'system';
  let visualRefresh;
  if (context.componentStories().length > 0) {
    const story = context.storyById();
    const { globals } = context.getStoryContext(story);
    themeId = globals.theme;
    visualRefresh = globals.visualRefresh;
  }
  const theme = applyVisualRefreshSetting(getThemeById(themeId), visualRefresh);

  return (
    <DocsContainer theme={createStorybookTheme(theme)} context={context}>
      <ThemeContext.Provider value={theme}>
        <GlobalStyles />
        {children}
      </ThemeContext.Provider>
    </DocsContainer>
  );
};
