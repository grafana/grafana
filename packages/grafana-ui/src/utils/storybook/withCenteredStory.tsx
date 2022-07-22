import React from 'react';

import { RenderFunction } from '../../types';

interface CenteredStoryProps {
  children: React.ReactNode;
  horizontal?: boolean;
  vertical?: boolean;
}
const CenteredStory: React.FunctionComponent<CenteredStoryProps> = ({ horizontal, vertical, children }) => {
  return (
    <div
      style={{
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        alignItems: vertical ? 'center' : 'flex-start',
        justifyContent: horizontal ? 'center' : 'flex-start',
      }}
    >
      {children}
    </div>
  );
};

export const withNotCenteredStory = (story: RenderFunction) => <CenteredStory>{story()}</CenteredStory>;
export const withCenteredStory = (story: RenderFunction) => (
  <CenteredStory horizontal vertical>
    {story()}
  </CenteredStory>
);
export const withHorizontallyCenteredStory = (story: RenderFunction) => (
  <CenteredStory horizontal>{story()}</CenteredStory>
);
export const withVerticallyCenteredStory = (story: RenderFunction) => <CenteredStory vertical>{story()}</CenteredStory>;
