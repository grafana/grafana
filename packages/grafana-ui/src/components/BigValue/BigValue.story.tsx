import { storiesOf } from '@storybook/react';
import { number, text } from '@storybook/addon-knobs';
import { BigValue } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    value: text('value', 'Hello'),
    valueFontSize: number('valueFontSize', 120),
    prefix: text('prefix', ''),
    sparkline: text('sparkline', '1,2,3,2,3,4,3,4'),
  };
};

const BigValueStories = storiesOf('UI/BigValue/BigValue', module);

BigValueStories.addDecorator(withCenteredStory);

BigValueStories.add('Simple Value', () => {
  const { value, prefix } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    value: {
      text: value,
      numeric: NaN,
    },
    prefix: prefix
      ? {
          text: prefix,
          numeric: NaN,
        }
      : null,
    // sparkline: [1, 2, 3, 2, 3, 3, 1, 2],
  });
});
