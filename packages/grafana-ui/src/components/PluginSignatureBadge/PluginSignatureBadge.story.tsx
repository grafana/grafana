import { Meta, StoryFn } from '@storybook/react';

import { PluginSignatureStatus } from '@grafana/data';

import { PluginSignatureBadge } from './PluginSignatureBadge';
import mdx from './PluginSignatureBadge.mdx';

const meta: Meta<typeof PluginSignatureBadge> = {
  title: 'Data Display/PluginSignatureBadge',
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

export const Basic: StoryFn<typeof PluginSignatureBadge> = (args) => {
  return <PluginSignatureBadge status={args.status} />;
};
Basic.args = {
  status: PluginSignatureStatus.valid,
};

export default meta;
