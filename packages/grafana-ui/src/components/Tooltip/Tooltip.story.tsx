import React from 'react';
import { Story } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import mdx from '../Tooltip/Tooltip.mdx';

export default {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disabled: true,
    },
  },
  argTypes: {
    content: {
      control: {
        type: 'text',
      },
    },
    theme: {
      control: {
        type: 'select',
        options: ['info', 'error'],
      },
    },
    placement: {
      control: {
        type: 'select',
        options: [
          'auto',
          'bottom',
          'top',
          'auto-start',
          'auto-end',
          'right',
          'left',
          'top-start',
          'top-end',
          'bottom-start',
          'bottom-end',
          'right-start',
          'right-end',
          'left-start',
          'left-end',
        ],
      },
    },
  },
};

export const Basic: Story = ({ content, ...args }) => {
  return (
    <Tooltip content={content} {...args}>
      <Button>Hover me for Tooltip </Button>
    </Tooltip>
  );
};
Basic.args = {
  content: 'This is a tooltip',
  theme: 'info',
  show: true,
  placement: 'auto',
};
