import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useId } from 'react';

import { Field } from '@grafana/ui';

import { defaultDecorators } from '../../../../../tests/story-utils';

import { RoutingTreeSelector, RoutingTreeSelectorProps } from './RoutingTreeSelector';
import mdx from './RoutingTreeSelector.mdx';
import {
  routingTreeWithErrorScenario,
  simpleRoutingTreesListScenario,
  singleDefaultTreeScenario,
} from './RoutingTreeSelector.test.scenario';

const meta: Meta<typeof RoutingTreeSelector> = {
  component: RoutingTreeSelector,
  title: 'Notification Policies/RoutingTreeSelector',
  decorators: defaultDecorators,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const StoryRenderFn: StoryFn<RoutingTreeSelectorProps> = (args) => {
  const id = useId();
  return (
    <Field noMargin label="Select notification policy">
      <RoutingTreeSelector {...args} id={id} />
    </Field>
  );
};

export default meta;
type Story = StoryObj<typeof RoutingTreeSelector>;

export const Basic: Story = {
  parameters: {
    msw: {
      handlers: simpleRoutingTreesListScenario,
    },
  },
  render: StoryRenderFn,
};

export const SingleDefaultTree: Story = {
  parameters: {
    msw: {
      handlers: singleDefaultTreeScenario,
    },
  },
  render: StoryRenderFn,
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: routingTreeWithErrorScenario,
    },
  },
  render: StoryRenderFn,
};
