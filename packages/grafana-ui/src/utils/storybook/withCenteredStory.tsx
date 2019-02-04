import React from 'react';
import { RenderFunction } from '@storybook/react';

const CenteredStory: React.FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
        height: '100vh  ',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

export const withCenteredStory = (story: RenderFunction) => <CenteredStory>{story()}</CenteredStory>;
