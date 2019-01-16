import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPickerPopover } from './ColorPickerPopover';

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
  // .add('Color picker popover', () => {
  //   return <ColorPickerPopover color="#ff0000" onColorSelect={() => {}} />;
  // })
  .add('Named colors swatch', () => {
    return <ColorPickerPopover color="#ff0000" onColorSelect={() => {}} />;
  });
