import { StoryFn, Meta } from '@storybook/react';

import { ShareUrlButton as ShareUrlButtonImpl, Props } from './ShareUrlButton';
import mdx from './ShareUrlButton.mdx';

const meta: Meta = {
  title: 'Buttons/ShareUrlButton',
  component: ShareUrlButtonImpl,
  args: {
    url: 'http://mygrafanainstance.grafana.net/dashboard/1?from=now-1h&to=now',
    fromParam: 'from',
    toParam: 'to',
  },
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['fill', 'type', 'tooltip', 'tooltipPlacement', 'size', 'variant', 'icon', 'className', 'fullWidth', 'getText', 'onClipboardCopy', 'onClipboardError'],
    },
  },
};

interface StoryProps extends Props {}

export const ShareUrlButton: StoryFn<StoryProps> = (args) => {
  return <ShareUrlButtonImpl {...args} />;
};

export default meta;
