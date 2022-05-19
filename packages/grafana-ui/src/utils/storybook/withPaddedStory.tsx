import React from 'react';

import { GlobalStyles, useTheme2 } from '../../themes';
import { RenderFunction } from '../../types';

const PaddedStory: React.FunctionComponent<{}> = ({ children }) => {
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

export const withPaddedStory = (story: RenderFunction) => <PaddedStory>{story()}</PaddedStory>;
