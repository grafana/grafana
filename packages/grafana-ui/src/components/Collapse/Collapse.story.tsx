import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/client-api';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Collapse, ControlledCollapse } from './Collapse';
import mdx from './Collapse.mdx';

const EXCLUDED_PROPS = ['className', 'onToggle'];

const meta: Meta<typeof Collapse> = {
  title: 'Layout/Collapse',
  component: Collapse,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: EXCLUDED_PROPS,
    },
  },
  args: {
    children: 'Panel data',
    isOpen: false,
    label: 'Collapse panel',
    collapsible: true,
  },
  argTypes: {
    onToggle: { action: 'toggled' },
  },
};

export const Basic: StoryFn<typeof Collapse> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <Collapse
      {...args}
      onToggle={() => {
        action('onToggle')({ isOpen: !args.isOpen });
        updateArgs({ isOpen: !args.isOpen });
      }}
    >
      <p>{args.children}</p>
    </Collapse>
  );
};

export const Controlled: StoryFn<typeof ControlledCollapse> = (args) => {
  return (
    <ControlledCollapse {...args}>
      <p>{args.children}</p>
    </ControlledCollapse>
  );
};
Controlled.parameters = {
  controls: {
    exclude: [...EXCLUDED_PROPS, 'isOpen'],
  },
};

export default meta;
