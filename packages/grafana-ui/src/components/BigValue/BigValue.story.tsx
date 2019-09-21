import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { BigValue } from './BigValue';
import { BigValue2 } from './BigValue2';
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

BigValueStories.add('Classic singlestat', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    value: {
      text: value,
      numeric: 5022,
      title,
    },
  });
});

BigValueStories.add('New Singlestat', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue2, {
    width: 400,
    height: 250,
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

BigValueStories.add('New Singlestat wide', () => {
  const { value, title } = getKnobs();

  return renderComponentWithTheme(BigValue2, {
    width: 500,
    height: 200,
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
