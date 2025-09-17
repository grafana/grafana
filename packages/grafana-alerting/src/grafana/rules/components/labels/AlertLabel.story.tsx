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
      <AlertLabel role="listitem" labelKey="alertname" value="HighErrorRate" />
      <AlertLabel role="listitem" labelKey="instance" value="web-01" />
      <AlertLabel role="listitem" labelKey="job" value="nginx" />
      <AlertLabel role="listitem" value="hello, world!" />
    </Stack>
  ),
};

export const Sizes: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <Text>md</Text>
      <AlertLabel role="listitem" labelKey="zone" value="us-east-1" size="md" />
      <Text>sm</Text>
      <AlertLabel role="listitem" labelKey="zone" value="us-east-1" size="sm" />
      <Text>xs</Text>
      <AlertLabel role="listitem" labelKey="zone" value="us-east-1" size="xs" />
    </Stack>
  ),
};

export const Clickable: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <AlertLabel
      {...args}
      role={'listitem'}
      labelKey="region"
      value="eu-central-1"
      onClick={([value, key]) => console.log('clicked', key, value)}
    />
  ),
};

export const WithIconAndColor: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1}>
      <AlertLabel role="listitem" icon="tag-alt" labelKey="owner" value="team-a" color="#268bd2" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="env" value="prod" color="#2aa198" />
      <hr />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="env" value="prod" colorBy="key" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="env" value="prod" colorBy="value" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="env" value="prod" colorBy="both" />
    </Stack>
  ),
};
