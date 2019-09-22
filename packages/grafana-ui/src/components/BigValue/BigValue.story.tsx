import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { BigValue, SingleStatDisplayMode } from './BigValue2';
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

BigValueStories.add('Mode: Classic', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    displayMode: SingleStatDisplayMode.Classic,
    value: {
      text: value,
      numeric: 5022,
      title,
    },
  });
});

BigValueStories.add('Mode: Colored Tiles Stacked', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 400,
    height: 250,
    displayMode: SingleStatDisplayMode.ColoredBackground,
    value: {
      text: value,
      numeric: 5022,
      title,
    },
    sparkline: {
      minX: 0,
      maxX: 5,
      data: [[0, 10], [1, 20], [2, 15], [3, 25], [4, 5], [5, 10]],
    },
  });
});

BigValueStories.add('Mode: Colored Tiles Wide', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 500,
    height: 120,
    displayMode: SingleStatDisplayMode.ColoredBackground,
    value: {
      text: value,
      numeric: 5022,
      title,
    },
    sparkline: {
      minX: 0,
      maxX: 5,
      data: [[0, 10], [1, 20], [2, 15], [3, 25], [4, 5], [5, 10]],
    },
  });
});

BigValueStories.add('Mode: Colored Area Graph', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 500,
    height: 400,
    displayMode: SingleStatDisplayMode.ColoredAreaGraph,
    value: {
      text: value,
      numeric: 5022,
      title,
    },
    sparkline: {
      minX: 0,
      maxX: 5,
      data: [[0, 10], [1, 20], [2, 15], [3, 25], [4, 5], [5, 10]],
    },
  });
});
