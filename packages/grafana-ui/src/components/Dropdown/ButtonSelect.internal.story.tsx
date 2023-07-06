import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { ButtonSelect } from './ButtonSelect';

const meta: Meta<typeof ButtonSelect> = {
  title: 'Forms/Select/ButtonSelect',
  component: ButtonSelect,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: ['className', 'onChange', 'tooltipContent'],
    },
  },
  args: {
    value: { label: 'A label', value: 'A value' },
    options: [
      { label: 'A label', value: 'A value' },
      { label: 'Another label', value: 'Another value' },
    ],
  },
};

export const Basic: StoryFn<typeof ButtonSelect> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <div style={{ marginLeft: '100px', position: 'relative', display: 'inline-block' }}>
      <ButtonSelect
        {...args}
        onChange={(value) => {
          action('onChange fired')(value);
          updateArgs({ value });
        }}
      />
    </div>
  );
};

export default meta;
