import React from 'react';
import { select } from '@storybook/addon-knobs';
import { PluginSignatureBadge } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { PluginSignatureStatus } from '@grafana/data';

export default {
  title: 'Data Display/PluginSignatureBadge',
  decorators: [withCenteredStory],
  component: PluginSignatureBadge,
};

const getKnobs = () => {
  return {
    status: select(
      'status',
      [
        PluginSignatureStatus.missing,
        PluginSignatureStatus.invalid,
        PluginSignatureStatus.modified,
        PluginSignatureStatus.valid,
        PluginSignatureStatus.internal,
      ],
      PluginSignatureStatus.valid
    ),
  };
};

export const basic = () => {
  const { status } = getKnobs();
  return <PluginSignatureBadge status={status} />;
};
