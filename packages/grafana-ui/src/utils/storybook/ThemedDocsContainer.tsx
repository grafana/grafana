// Wrap the DocsContainer for theme switching support.
import { DocsContainer, DocsContextProps } from '@storybook/addon-docs';
import * as React from 'react';

import { getThemeById } from '@grafana/data';

import { createStorybookTheme } from '../../../.storybook/storybookTheme';
import { GlobalStyles } from '../../themes';

type Props = {
  context: DocsContextProps;
  children?: React.ReactNode;
};

export const ThemedDocsContainer = ({ children, context }: Props) => {
  // Default to system theme for pages that don't have associated stories
  // Currently this is only the case for the docs `Intro` page
  let themeId = 'system';
  if (context.componentStories().length > 0) {
    const story = context.storyById();
    const { globals } = context.getStoryContext(story);
    themeId = globals.theme;
  }
  const theme = getThemeById(themeId);

  return (
    <DocsContainer theme={createStorybookTheme(theme)} context={context}>
      <GlobalStyles />
      {children}
    </DocsContainer>
  );
};
