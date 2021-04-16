import React from 'react';
import { GlobalStyles, useTheme } from '../../themes';
import { RenderFunction } from '../../types';

const PaddedStory: React.FunctionComponent<{}> = ({ children }) => {
  const theme = useTheme();

  return (
    <div
      style={{
        width: '100%',
        padding: '20px',
        display: 'flex',
        minHeight: '80vh',
        background: `${theme.v2.palette.layer1}`,
      }}
    >
      <GlobalStyles />
      {children}
    </div>
  );
};

export const withPaddedStory = (story: RenderFunction) => <PaddedStory>{story()}</PaddedStory>;
