import { text } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Cascader } from './Cascader';
// import { Button } from '../Button';
import mdx from './Cascader.mdx';
import React from 'react';

export default {
  title: 'General/Cascader',
  component: Cascader,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const options = [
  {
    label: 'First',
    value: '1',
    items: [
      {
        label: 'Second',
        value: '2',
      },
      {
        label: 'Third',
        value: '3',
      },
      {
        label: 'Fourth',
        value: '4',
      },
    ],
  },
  {
    label: 'FirstFirst',
    value: '5',
  },
];

export const simple = () => (
  <Cascader separator={text('Separator', '')} options={options} onSelect={val => console.log(val)} />
);
export const withInitialValue = () => (
  <Cascader options={options} initialValue="3" onSelect={val => console.log(val)} />
);

export const withCustomValue = () => {
  const onCreateLabel = text('Custom value creation label', 'Create new value: ');
  return (
    <Cascader
      options={options}
      allowCustomValue
      formatCreateLabel={val => onCreateLabel + val}
      initialValue="Custom Initial Value"
      onSelect={val => console.log(val)}
    />
  );
};
