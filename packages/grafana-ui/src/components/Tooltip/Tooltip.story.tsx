import { Meta, StoryFn } from '@storybook/react';

import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';
import mdx from '../Tooltip/Tooltip.mdx';

import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
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

export const Basic: StoryFn<typeof Tooltip> = ({ content, ...args }) => {
  return (
    <Tooltip content={content} {...args}>
      <Button>Hover me for Tooltip </Button>
    </Tooltip>
  );
};

export const OverflowViewport: StoryFn<typeof Tooltip> = ({}) => {
  const content = () => <div>A really long tooltip that will overflow the viewport.</div>;

  return (
    <Stack justifyContent={'flex-end'}>
      <Stack direction="column" alignItems={'flex-end'}>
        <Tooltip content="Static string tooltip" placement="bottom">
          <Button>Static string tooltip</Button>
        </Tooltip>
        <Tooltip content={content} placement="bottom">
          <Button>Lazy content defined in a function</Button>
        </Tooltip>
      </Stack>
    </Stack>
  );
};

Basic.args = {
  content: 'This is a tooltip',
  theme: 'info',
  show: undefined,
  placement: 'auto',
};

export default meta;
