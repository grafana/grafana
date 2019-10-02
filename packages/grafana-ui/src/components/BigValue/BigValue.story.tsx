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
  };
};

const BigValueStories = storiesOf('UI/BigValue', module);

BigValueStories.addDecorator(withCenteredStory);

BigValueStories.add('Singlestat viz', () => {
  const { value, prefix, valueFontSize } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    value: {
      text: value,
      numeric: NaN,
      fontSize: valueFontSize + '%',
    },
    prefix: prefix
      ? {
          text: prefix,
          numeric: NaN,
        }
      : null,
  });
});
