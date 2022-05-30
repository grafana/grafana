import { Story } from '@storybook/react';
import React from 'react';

import { PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

export default {
  title: 'Data Display/PluginSignatureBadge',
  decorators: [withCenteredStory],
  component: PluginSignatureBadge,
  argTypes: {
    status: {
      control: {
        type: 'select',
      },
      options: [
        PluginSignatureStatus.missing,
        PluginSignatureStatus.invalid,
        PluginSignatureStatus.modified,
        PluginSignatureStatus.valid,
        PluginSignatureStatus.internal,
      ],
    },
  },
};

export const Basic: Story = (args) => {
  return <PluginSignatureBadge status={args.status} />;
};
Basic.args = {
  status: PluginSignatureStatus.valid,
};
