import React from 'react';
import { RenderFunction } from '@storybook/react';

const PaddedStory: React.FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        padding: '20px',
        display: 'flex',
      }}
    >
      {children}
    </div>
  );
};

export const withPaddedStory = (story: RenderFunction) => <PaddedStory>{story()}</PaddedStory>;
