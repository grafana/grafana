import React from 'react';

import { RenderFunction } from '../../types';

const RightAlignedStory = ({ children }: { children: React.ReactNode }) => {
  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        marginRight: '20px',
      }}
    >
      {children}
    </div>
  );
};

export const withRightAlignedStory = (story: RenderFunction) => <RightAlignedStory>{story()}</RightAlignedStory>;
