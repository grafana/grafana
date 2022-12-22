import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { PluginSignatureStatus } from '@grafana/data';
import { PluginSignatureBadge } from '@grafana/ui';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import mdx from './PluginSignatureBadge.mdx';

const meta: ComponentMeta<typeof PluginSignatureBadge> = {
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
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const Basic: ComponentStory<typeof PluginSignatureBadge> = (args) => {
  return <PluginSignatureBadge status={args.status} />;
};
Basic.args = {
  status: PluginSignatureStatus.valid,
};

export default meta;
