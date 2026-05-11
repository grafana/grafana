import { type Meta, type StoryFn } from '@storybook/react-webpack5';

import { PluginSignatureStatus } from '@grafana/data';

import { PluginSignatureBadge } from './PluginSignatureBadge';
import mdx from './PluginSignatureBadge.mdx';

const meta: Meta<typeof PluginSignatureBadge> = {
  title: 'Information/PluginSignatureBadge',
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
