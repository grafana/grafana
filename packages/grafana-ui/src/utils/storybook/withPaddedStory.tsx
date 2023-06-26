import { DecoratorFn } from '@storybook/react';
import React from 'react';

import { GlobalStyles, useTheme2 } from '../../themes';

const PaddedStory = ({ children }: React.PropsWithChildren<{}>) => {
  const theme = useTheme2();

  return (
    <div
      style={{
        width: '100%',
        padding: '20px',
        display: 'flex',
        minHeight: '100%',
        background: `${theme.colors.background.primary}`,
      }}
    >
      <GlobalStyles />
      {children}
    </div>
  );
};

export const withPaddedStory: DecoratorFn = (story) => <PaddedStory>{story()}</PaddedStory>;
