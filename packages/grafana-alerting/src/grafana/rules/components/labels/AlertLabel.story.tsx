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
    <Stack direction="column" alignItems="flex-start" gap={1} role="list">
      <AlertLabel role="listitem" labelKey="alertname" value="HighErrorRate" />
      <AlertLabel role="listitem" labelKey="instance" value="web-01" />
      <AlertLabel role="listitem" labelKey="job" value="nginx" />
      <AlertLabel role="listitem" value="hello, world!" />
    </Stack>
  ),
};

export const Sizes: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1} role="list">
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
      labelKey="region"
      value="eu-central-1"
      onClick={([value, key]) => console.log('clicked', key, value)}
    />
  ),
};

export const WithIconAndColor: StoryObj<typeof AlertLabel> = {
  render: (args: ComponentProps<typeof AlertLabel>) => (
    <Stack direction="column" alignItems="flex-start" gap={1} role="list">
      <AlertLabel role="listitem" icon="tag-alt" labelKey="setColor" value="#268bd2" color="#268bd2" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="setColor" value="#2aa198" color="#2aa198" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="colorBy" value="key" colorBy="key" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="colorBy" value="value" colorBy="value" />
      <AlertLabel role="listitem" icon="tag-alt" labelKey="colorBy" value="both" colorBy="both" />
    </Stack>
  ),
};
