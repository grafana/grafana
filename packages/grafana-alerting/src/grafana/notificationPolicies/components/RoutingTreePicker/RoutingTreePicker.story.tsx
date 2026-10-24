import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { defaultDecorators } from '../../../../../tests/story-utils';
import { type RoutingTreeView } from '../../routingTreeView';
import { simpleRoutingTreesListScenario } from '../RoutingTreeSelector/RoutingTreeSelector.scenario';

import { RoutingTreePicker, type RoutingTreePickerProps } from './RoutingTreePicker';

const meta: Meta<typeof RoutingTreePicker> = {
  component: RoutingTreePicker,
  title: 'Notification Policies/RoutingTreePicker',
  decorators: defaultDecorators,
  parameters: {
    msw: {
      handlers: simpleRoutingTreesListScenario,
    },
  },
};

// Standing in for "a consumer with no RuleFormValues context" - just React state, no form/redux wiring.
const StoryRenderFn: StoryFn<RoutingTreePickerProps> = (args) => {
  const [value, setValue] = useState<RoutingTreeView | null>(args.value ?? null);

  return <RoutingTreePicker {...args} value={value} onChange={setValue} />;
};

export default meta;
type Story = StoryObj<typeof RoutingTreePicker>;

export const Basic: Story = {
  args: {
    viewPoliciesHref: '/alerting/routes',
  },
  render: StoryRenderFn,
};

export const WithPreview: Story = {
  args: {
    instancesToPreview: [[['severity', 'critical']]],
  },
  render: StoryRenderFn,
};
