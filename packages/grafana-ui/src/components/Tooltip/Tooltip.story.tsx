import React from 'react';
import { select } from '@storybook/addon-knobs';
import { Tooltip } from './Tooltip';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import mdx from '../Tooltip/Tooltip.mdx';

export default {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const VISUAL_GROUP = 'Visual options';
  // ---
  const theme = select('Theme', ['info', 'error', 'info-alt'], 'info', VISUAL_GROUP);
  return (
    <Tooltip content="This is a tooltip" theme={theme}>
      <Button>Hover me for Tooltip </Button>
    </Tooltip>
  );
};
