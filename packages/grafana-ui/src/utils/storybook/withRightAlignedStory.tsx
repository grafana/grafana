import { DecoratorFn } from '@storybook/react';
import React from 'react';

const RightAlignedStory = ({ children }: React.PropsWithChildren<{}>) => {
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

export const withRightAlignedStory: DecoratorFn = (story) => <RightAlignedStory>{story()}</RightAlignedStory>;
