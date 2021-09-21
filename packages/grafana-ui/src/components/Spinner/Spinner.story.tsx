import React from 'react';
import { Meta, Story } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Spinner } from '@grafana/ui';
import { Props } from './Spinner';
import mdx from './Spinner.mdx';

export default {
  title: 'Visualizations/Spinner',
  component: Spinner,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['className', 'iconClassName', 'style', 'inline'],
    },
  },
  argTypes: {
    backgroundColor: { control: { type: 'color' } },
    color: { control: { type: 'color' } },
  },
} as Meta;

interface StoryProps extends Partial<Props> {
  backgroundColor: string;
  color: string;
  withStyle: boolean;
}

export const Basic: Story<StoryProps> = (args) => {
  return (
    <div>
      <Spinner
        style={
          args.withStyle === true
            ? {
                backgroundColor: `${args.backgroundColor}`,
                color: `${args.color}`,
              }
            : {}
        }
        size={args.size}
      />
    </div>
  );
};
Basic.args = {
  backgroundColor: 'white',
  color: 'red',
  size: 34,
  withStyle: false,
};
