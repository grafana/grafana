import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { ColorPicker } from './ColorPicker';
import { SeriesColorPicker } from './SeriesColorPicker';
import { UseState } from './NamedColorsPalette.story';
import { withKnobs, select } from '@storybook/addon-knobs';
import { GrafanaTheme } from '../../types';

// TODO: extract to decorators
export const CenteredStory: FunctionComponent<{}> = ({ children }) => {
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
  const selectedTheme = select(
    'Theme',
    {
      Default: '',
      Light: GrafanaTheme.Light,
      Dark: GrafanaTheme.Dark,
    },
    GrafanaTheme.Light
  );

  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return <ColorPicker color={selectedColor} onChange={updateSelectedColor} theme={selectedTheme || undefined} />;
      }}
    </UseState>
  );
});

ColorPickerStories.add('Series color picker', () => {
  const selectedTheme = select(
    'Theme',
    {
      Default: '',
      Light: GrafanaTheme.Light,
      Dark: GrafanaTheme.Dark,
    },
    GrafanaTheme.Light
  );

  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <SeriesColorPicker
            yaxis={1}
            onToggleAxis={() => {}}
            color={selectedColor}
            onChange={color => updateSelectedColor(color)}
            theme={selectedTheme || undefined}
          >
            <div style={{ color: selectedColor }}>Open color picker</div>
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
});
