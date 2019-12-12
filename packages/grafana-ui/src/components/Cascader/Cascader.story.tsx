import React from 'react';
import { storiesOf } from '@storybook/react';
import { text, boolean, object } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Cascader } from './Cascader';

const getKnobs = () => {
  return {
    disabled: boolean('Disabled', false),
    text: text('Button Text', 'Click me!'),
    options: object('Options', [
      {
        label: 'A',
        value: 'A',
        children: [
          { label: 'B', value: 'B' },
          { label: 'C', value: 'C' },
        ],
      },
      { label: 'D', value: 'D' },
    ]),
  };
};

const CascaderStories = storiesOf('UI/Cascader', module);

CascaderStories.addDecorator(withCenteredStory);

CascaderStories.add('default', () => {
  const { disabled, text, options } = getKnobs();
  return <Cascader disabled={disabled} options={options} value={['A']} expandIcon={null} buttonText={text} />;
});
