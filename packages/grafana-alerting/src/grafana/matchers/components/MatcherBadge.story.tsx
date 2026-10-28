import type { Meta, StoryObj } from '@storybook/react';
import { type ComponentProps } from 'react';

import { Stack } from '@grafana/ui';

import { MatcherBadge } from './MatcherBadge';

const meta: Meta<typeof MatcherBadge> = {
  component: MatcherBadge,
  title: 'Matchers/MatcherBadge',
  args: {
    name: 'team',
    operator: '=',
    value: 'operations',
  },
};

export default meta;

export const Basic: StoryObj<typeof MatcherBadge> = {
  render: (args: ComponentProps<typeof MatcherBadge>) => <MatcherBadge {...args} />,
};

export const Operators: StoryObj<typeof MatcherBadge> = {
  render: () => (
    <Stack direction="row" alignItems="center" gap={1} wrap="wrap" role="list">
      <MatcherBadge role="listitem" name="severity" operator="=" value="critical" />
      <MatcherBadge role="listitem" name="env" operator="!=" value="dev" />
      <MatcherBadge role="listitem" name="region" operator="=~" value="eu-.*" />
      <MatcherBadge role="listitem" name="service" operator="!~" value="test|staging" />
    </Stack>
  ),
};

export const Whitespace: StoryObj<typeof MatcherBadge> = {
  render: () => (
    <Stack direction="row" alignItems="center" gap={1} wrap="wrap" role="list">
      <MatcherBadge role="listitem" name="team" operator="=" value="" />
      <MatcherBadge role="listitem" name="team" operator="=" value=" operations " />
    </Stack>
  ),
};

export const CustomColor: StoryObj<typeof MatcherBadge> = {
  render: () => (
    <Stack direction="row" alignItems="center" gap={1} wrap="wrap" role="list">
      <MatcherBadge role="listitem" name="team" operator="=" value="operations" />
      <MatcherBadge role="listitem" name="team" operator="=" value="operations" color="a different color key" />
    </Stack>
  ),
};
