// This is a temporary workaround to allow theme switching storybook docs
// see https://github.com/storybookjs/storybook/issues/10523 for further details
import { DocsContainer, DocsContextProps } from '@storybook/addon-docs';
import React from 'react';
import { useDarkMode } from 'storybook-dark-mode';

import { GrafanaLight, GrafanaDark } from '../../../.storybook/storybookTheme';

type Props = {
  context: DocsContextProps;
};

export const ThemedDocsContainer: React.FC<Props> = ({ children, context }) => {
  const dark = useDarkMode();

  return (
    <DocsContainer
      context={{
        ...context,
        storyById: (id) => {
          const storyContext = context.storyById(id);
          return {
            ...storyContext,
            parameters: {
              ...storyContext?.parameters,
              docs: {
                ...storyContext?.parameters.docs,
                theme: dark ? GrafanaDark : GrafanaLight,
              },
            },
          };
        },
      }}
    >
      {children}
    </DocsContainer>
  );
};
