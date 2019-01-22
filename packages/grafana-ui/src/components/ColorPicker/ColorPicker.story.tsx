import React, { FunctionComponent } from 'react';
import { storiesOf } from '@storybook/react';
import { SeriesColorPicker } from './ColorPicker';
import { ColorPicker } from './ColorPicker';
import { UseState } from './NamedColorsPalette.story';
import { withKnobs, select, boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
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

const getColorPickerKnobs = (defaultTheme: GrafanaTheme = GrafanaTheme.Light, enableNamedColors?: boolean) => {
  return {
    selectedTheme: select(
      'Theme',
      {
        Default: '',
        Light: GrafanaTheme.Light,
        Dark: GrafanaTheme.Dark,
      },
      defaultTheme
    ),
    enableNamedColors: boolean('Enable named colors', !!enableNamedColors),
  };
};

const ColorPickerStories = storiesOf('UI/ColorPicker', module);
ColorPickerStories.addDecorator(story => <CenteredStory>{story()}</CenteredStory>);
ColorPickerStories.addDecorator(withKnobs);

ColorPickerStories.add('Color picker', () => {
  const { selectedTheme, enableNamedColors } = getColorPickerKnobs();
  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <ColorPicker
            enableNamedColors={enableNamedColors}
            color={selectedColor}
            onChange={color => {
              action('Color changed')(color);
              updateSelectedColor(color);
            }}
            theme={selectedTheme || undefined}
          />
        );
      }}
    </UseState>
  );
});

ColorPickerStories.add('Series color picker', () => {
  const { selectedTheme, enableNamedColors } = getColorPickerKnobs();

  return (
    <UseState initialState="#00ff00">
      {(selectedColor, updateSelectedColor) => {
        return (
          <SeriesColorPicker
            enableNamedColors={enableNamedColors}
            yaxis={1}
            onToggleAxis={() => {}}
            color={selectedColor}
            onChange={color => updateSelectedColor(color)}
            theme={selectedTheme || undefined}
          >
            <div style={{ color: selectedColor, cursor: 'pointer' }}>Open color picker</div>
          </SeriesColorPicker>
        );
      }}
    </UseState>
  );
});
