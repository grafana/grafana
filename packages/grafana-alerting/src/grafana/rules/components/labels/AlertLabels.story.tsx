import type { Meta, StoryObj } from '@storybook/react';
import { ComponentProps } from 'react';

import { Stack } from '@grafana/ui';

import { AlertLabels } from './AlertLabels';

const meta: Meta<typeof AlertLabels> = {
  component: AlertLabels,
  title: 'Rules/AlertLabels',
};

export default meta;

export const Basic: StoryObj<typeof AlertLabels> = {
  render: (args: ComponentProps<typeof AlertLabels>) => (
    <Stack direction="column" alignItems="flex-start">
      <AlertLabels
        {...args}
        labels={{ alertname: 'HighErrorRate', instance: 'web-01', job: 'nginx', zone: 'us-east-1' }}
      />
      <AlertLabels
        {...args}
        size="sm"
        labels={{ alertname: 'HighCPU', instance: 'db-02', job: 'postgres', zone: 'us-west-2' }}
      />
      <AlertLabels
        {...args}
        size="xs"
        labels={{ alertname: 'DiskFull', instance: 'cache-3', job: 'redis', zone: 'eu-central-1' }}
      />
    </Stack>
  ),
};

export const WithCommonLabels: StoryObj<typeof AlertLabels> = {
  render: (args: ComponentProps<typeof AlertLabels>) => (
    <AlertLabels
      {...args}
      labels={{ foo: 'bar', bar: 'baz', baz: 'qux' }}
      displayCommonLabels
      labelSets={[
        { foo: 'bar', bar: 'baz', baz: 'qux' },
        { foo: 'bar', baz: 'qux', quux: 'corge' },
      ]}
    />
  ),
};
