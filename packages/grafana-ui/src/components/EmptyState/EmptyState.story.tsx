import { type Meta, type StoryFn } from '@storybook/react';

import { Button } from '../Button/Button';
import { Text } from '../Text/Text';

import { EmptyState } from './EmptyState';
import mdx from './EmptyState.mdx';

const meta: Meta<typeof EmptyState> = {
  title: 'Information/EmptyState',
  component: EmptyState,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['image'],
    },
  },
  argTypes: {
    button: {
      control: 'select',
      options: ['None', 'Create', 'Clear filters'],
    },
    children: {
      type: 'string',
    },
  },
};

export const Basic: StoryFn<typeof EmptyState> = (args) => {
  let button;
  if (args.button === 'Create') {
    button = (
      <Button icon="plus" size="lg">
        Create dashboard
      </Button>
    );
  } else if (args.button === 'Clear filters') {
    button = <Button variant="secondary">Clear filters</Button>;
  }
  return <EmptyState {...args} button={button} />;
};

Basic.args = {
  button: 'Create',
  children: 'Use this space to add any additional information',
  message: "You haven't created any dashboards yet",
  variant: 'call-to-action',
};

export const SemanticHeading: StoryFn<typeof EmptyState> = (args) => (
  <EmptyState
    {...args}
    message={
      <Text element="h2" variant="h4" textAlignment="center">
        {args.message ?? 'No playlists found'}
      </Text>
    }
  />
);

SemanticHeading.args = {
  message: 'No playlists found',
  variant: 'not-found',
};

export default meta;
