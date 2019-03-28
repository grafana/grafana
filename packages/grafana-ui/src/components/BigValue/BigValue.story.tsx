import { storiesOf } from '@storybook/react';
import { number, text, boolean } from '@storybook/addon-knobs';
import { BigValue } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';

const getKnobs = () => {
  return {
    value: text('value', 'Hello'),
    valueFontSize: number('valueFontSize', 120),
    prefix: text('prefix', ''),
    tooltip: text('tooltip', 'This is a tooltip'),
    link: text('link', 'https://grafana.com/'),
    linkNewWindow: boolean('linkNewWindow', false),
  };
};

const BigValueStories = storiesOf('UI/BigValue', module);

BigValueStories.addDecorator(withCenteredStory);

BigValueStories.add('Singlestat viz', () => {
  const { value, prefix, valueFontSize, tooltip, link, linkNewWindow } = getKnobs();

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    value: {
      text: value,
      numeric: NaN,
      fontSize: valueFontSize + '%',
      tooltip,
      link,
      linkNewWindow,
    },
    prefix: prefix
      ? {
          text: prefix,
          numeric: NaN,
        }
      : null,
  });
});
