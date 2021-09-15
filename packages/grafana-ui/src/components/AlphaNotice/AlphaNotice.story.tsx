import React from 'react';
import { PluginState } from '@grafana/data';
import { AlphaNotice } from './AlphaNotice';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './AlphaNotice.mdx';

export default {
  title: 'Overlays/AlphaNotice',
  component: AlphaNotice,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return <AlphaNotice state={PluginState.alpha} text="This is an alpha feature" />;
};
