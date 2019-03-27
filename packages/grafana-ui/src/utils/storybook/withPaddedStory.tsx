import React from 'react';
import { RenderFunction } from '@storybook/react';

const PaddedStory: React.FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        padding: '20px',
      }}
    >
      {children}
    </div>
  );
};

export const withPaddedStory = (story: RenderFunction) => <PaddedStory>{story()}</PaddedStory>;
