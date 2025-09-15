import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Stack, Text } from '@grafana/ui';

import { Label } from './AlertLabel';

const meta: Meta<typeof Label> = {
  component: Label,
  title: 'Rules/AlertLabel',
};

export default meta;

export const Basic: StoryObj<typeof Label> = {
  render: (args: ComponentProps<typeof Label>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <Label {...args} label="alertname" value="HighErrorRate" />
      <Label {...args} label="instance" value="web-01" />
      <Label {...args} label="job" value="nginx" />
    </Stack>
  ),
};

export const Sizes: StoryObj<typeof Label> = {
  render: (args: ComponentProps<typeof Label>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <Text>md</Text>
      <Label {...args} label="zone" value="us-east-1" size="md" />
      <Text>sm</Text>
      <Label {...args} label="zone" value="us-east-1" size="sm" />
      <Text>xs</Text>
      <Label {...args} label="zone" value="us-east-1" size="xs" />
    </Stack>
  ),
};

export const Clickable: StoryObj<typeof Label> = {
  render: (args: ComponentProps<typeof Label>) => (
    <Label
      {...args}
      label="region"
      value="eu-central-1"
      onClick={(label, value) => console.log('clicked', label, value)}
    />
  ),
};

export const WithIconAndColor: StoryObj<typeof Label> = {
  render: (args: ComponentProps<typeof Label>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <Label {...args} icon="tag-alt" label="owner" value="team-a" color="#268bd2" />
      <Label {...args} icon="tag-alt" label="env" value="prod" color="#2aa198" />
    </Stack>
  ),
};
