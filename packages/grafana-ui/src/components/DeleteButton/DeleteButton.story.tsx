import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { DeleteButton } from '@grafana/ui';

const CenteredStory: FunctionComponent<{}> = ({ children }) => {
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

storiesOf('UI/DeleteButton', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .add('default', () => {
    return <DeleteButton onConfirm={() => {}} />;
  });
