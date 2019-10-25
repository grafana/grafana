import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { BigValue, SingleStatDisplayMode } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    value: text('value', '$5022'),
    title: text('title', 'Total Earnings'),
  };
};

const BigValueStories = storiesOf('UI/BigValue', module);

BigValueStories.addDecorator(withCenteredStory);

interface StoryOptions {
  mode: SingleStatDisplayMode;
  width?: number;
  height?: number;
  noSparkline?: boolean;
}

function addStoryForMode(options: StoryOptions) {
  BigValueStories.add(`Mode: ${SingleStatDisplayMode[options.mode]}`, () => {
    const { value, title } = getKnobs();

    return renderComponentWithTheme(BigValue, {
      width: options.width || 400,
      height: options.height || 300,
      displayMode: options.mode,
      value: {
        text: value,
        numeric: 5022,
        color: 'red',
        title,
      },
      sparkline: {
        minX: 0,
        maxX: 5,
        data: [[0, 10], [1, 20], [2, 15], [3, 25], [4, 5], [5, 10]],
      },
    });
  });
}

addStoryForMode({ mode: SingleStatDisplayMode.Classic });
addStoryForMode({ mode: SingleStatDisplayMode.Classic2 });
addStoryForMode({ mode: SingleStatDisplayMode.Vibrant });
addStoryForMode({ mode: SingleStatDisplayMode.Vibrant2 });
