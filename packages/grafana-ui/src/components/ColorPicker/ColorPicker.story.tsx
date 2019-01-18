import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPicker } from './ColorPicker';
import { withKnobs, text } from '@storybook/addon-knobs';

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

const ColorPickerStories = storiesOf('UI/ColorPicker', module);

ColorPickerStories.addDecorator(story => <CenteredStory>{story()}</CenteredStory>);
ColorPickerStories.addDecorator(withKnobs);
ColorPickerStories.add('Color picker', () => {
  return <ColorPicker color={text('Color HEX or Name or RGB string', '#ff0000')} onChange={() => {}} />;
});
