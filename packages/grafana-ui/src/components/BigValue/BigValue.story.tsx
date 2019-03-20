import React from 'react';
import { storiesOf } from '@storybook/react';
import { number, text, boolean } from '@storybook/addon-knobs';
import { BigValue } from './BigValue';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { renderComponentWithTheme } from '../../utils/storybook/withTheme';
import { action } from '@storybook/addon-actions';

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

BigValueStories.add('Simple Value', () => {
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

BigValueStories.add('value with tooltip and link', () => {
  const { value, prefix, valueFontSize } = getKnobs();

  const customTTip = (
    <div style={{ padding: '10px' }}>
      <h5>Tooltip!</h5>
      <p>Some Longer Text here</p>
    </div>
  );

  return renderComponentWithTheme(BigValue, {
    width: 300,
    height: 250,
    value: {
      text: value,
      numeric: NaN,
      fontSize: valueFontSize + '%',
      tooltip: customTTip,
      link: () => {
        console.log('Clicked value');
        action('clicked value');
      },
    },
    prefix: prefix
      ? {
          text: prefix,
          numeric: NaN,
        }
      : null,
  });
});
