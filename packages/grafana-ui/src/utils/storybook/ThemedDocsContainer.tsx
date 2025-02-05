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
  const story = context.storyById();
  const { globals } = context.getStoryContext(story);
  const { theme: themeId } = globals;
  const theme = getThemeById(themeId);

  return (
    <DocsContainer theme={createStorybookTheme(theme)} context={context}>
      <GlobalStyles />
      {children}
    </DocsContainer>
  );
};
