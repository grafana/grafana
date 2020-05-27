import React from 'react';
import SpectrumPalette from './SpectrumPalette';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { UseState } from '../../utils/storybook/UseState';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import mdx from './ColorPicker.mdx';

export default {
  title: 'Pickers and Editors/ColorPicker/Palettes/SpectrumPalette',
  component: SpectrumPalette,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const simple = () => {
  return (
    <UseState initialState="red">
      {(selectedColor, updateSelectedColor) => {
        return renderComponentWithTheme(SpectrumPalette, { color: selectedColor, onChange: updateSelectedColor });
      }}
    </UseState>
  );
};
