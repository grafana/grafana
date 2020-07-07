import React from 'react';
import { RenderFunction } from '../../types';

const PaddedStory: React.FunctionComponent<{}> = ({ children }) => {
  return (
    <div
      style={{
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
