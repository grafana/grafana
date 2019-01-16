import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPicker } from '@grafana/ui';
import { withInfo } from '@storybook/addon-info';

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

storiesOf('UI/ColorPicker', module)
  .addDecorator(story => <CenteredStory>{story()}</CenteredStory>)
  .add('default', withInfo({inline: true})(() => {
    return <ColorPicker color="#ff0000" onChange={() => {}} />;
  }));
