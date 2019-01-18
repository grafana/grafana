import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPicker } from './ColorPicker';
import { SeriesColorPicker } from './SeriesColorPicker';
import { UseState } from './NamedColorsPicker.story';

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
ColorPickerStories.add('Color picker', () => {
  return <ColorPicker color="#ff0000" onChange={() => {}} />;
});
ColorPickerStories.add('Series color picker', () => {
  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <SeriesColorPicker
            yaxis={1}
            onToggleAxis={() => {}}
            color={selectedColor}
            onChange={color => updateSelectedColor(color)}
          >
            <div style={{color: selectedColor}}>Open color picker</div>
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
});
