import { DecoratorFn } from '@storybook/react';
import React from 'react';

interface CenteredStoryProps {
  children: React.ReactNode;
  horizontal?: boolean;
  vertical?: boolean;
}
const CenteredStory = ({ horizontal, vertical, children }: CenteredStoryProps) => {
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

export const withNotCenteredStory: DecoratorFn = (story) => <CenteredStory>{story()}</CenteredStory>;
export const withCenteredStory: DecoratorFn = (story) => (
  <CenteredStory horizontal vertical>
    {story()}
  </CenteredStory>
);
export const withHorizontallyCenteredStory: DecoratorFn = (story) => (
  <CenteredStory horizontal>{story()}</CenteredStory>
);
export const withVerticallyCenteredStory: DecoratorFn = (story) => <CenteredStory vertical>{story()}</CenteredStory>;
