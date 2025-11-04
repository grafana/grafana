import { action } from '@storybook/addon-actions';
import { useArgs } from '@storybook/preview-api';
import { Meta, StoryFn } from '@storybook/react';

import { IconButton } from '../IconButton/IconButton';
import { Stack } from '../Layout/Stack/Stack';

import { Collapse, ControlledCollapse } from './Collapse';
import mdx from './Collapse.mdx';

const EXCLUDED_PROPS = ['className', 'onToggle'];

const meta: Meta<typeof Collapse> = {
  title: 'Layout/Collapse',
  component: Collapse,
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

export const WithCustomLabel: StoryFn<typeof Collapse> = (args) => {
  const [, updateArgs] = useArgs();
  return (
    <Collapse
      {...args}
      onToggle={() => {
        action('onToggle')({ isOpen: !args.isOpen });
        updateArgs({ isOpen: !args.isOpen });
      }}
      label={
        <Stack flex={1} alignItems="center" justifyContent="space-between">
          Collapse panel
          <Stack alignItems="center">
            <IconButton
              onClick={(event) => {
                event.stopPropagation();
                action('onDeleteClick')();
              }}
              aria-label="Delete"
              name="trash-alt"
            />
          </Stack>
        </Stack>
      }
    >
      <p>{args.children}</p>
    </Collapse>
  );
};
WithCustomLabel.parameters = {
  controls: {
    exclude: [...EXCLUDED_PROPS, 'label'],
  },
};

export default meta;
