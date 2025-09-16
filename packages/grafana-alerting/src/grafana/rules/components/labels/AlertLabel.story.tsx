import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Stack, Text } from '@grafana/ui';

import { AlertLabel } from './AlertLabel';

const meta: Meta<typeof AlertLabel> = {
  component: AlertLabel,
  title: 'Rules/AlertLabel',
};

export default meta;

export const Basic: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <AlertLabel {...args} asListItem={false} label="alertname" value="HighErrorRate" />
      <AlertLabel {...args} asListItem={false} label="instance" value="web-01" />
      <AlertLabel {...args} asListItem={false} label="job" value="nginx" />
    </Stack>
  ),
};

export const Sizes: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <Text>md</Text>
      <AlertLabel {...args} asListItem={false} label="zone" value="us-east-1" size="md" />
      <Text>sm</Text>
      <AlertLabel {...args} asListItem={false} label="zone" value="us-east-1" size="sm" />
      <Text>xs</Text>
      <AlertLabel {...args} asListItem={false} label="zone" value="us-east-1" size="xs" />
    </Stack>
  ),
};

export const Clickable: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <AlertLabel
      {...args}
      asListItem={false}
      label="region"
      value="eu-central-1"
      onClick={(label, value) => console.log('clicked', label, value)}
    />
  ),
};

export const WithIconAndColor: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <AlertLabel {...args} asListItem={false} icon="tag-alt" label="owner" value="team-a" color="#268bd2" />
      <AlertLabel {...args} asListItem={false} icon="tag-alt" label="env" value="prod" color="#2aa198" />
    </Stack>
  ),
};
