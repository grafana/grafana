import { StoryFn, Meta } from '@storybook/react';

import { ShareTimeRangeButton as ShareTimeRangeButtonImpl, Props } from './ShareTimeRangeButton';
import mdx from './ShareTimeRangeButton.mdx';

const meta: Meta = {
  title: 'Buttons/ShareTimeRangeButton',
  component: ShareTimeRangeButtonImpl,
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
      exclude: [
        'fill',
        'type',
        'tooltip',
        'tooltipPlacement',
        'size',
        'variant',
        'icon',
        'className',
        'fullWidth',
        'getText',
        'onClipboardCopy',
        'onClipboardError',
      ],
    },
  },
};

interface StoryProps extends Props {}

export const ShareTimeRangeButton: StoryFn<StoryProps> = (args) => {
  return <ShareTimeRangeButtonImpl {...args} />;
};

export default meta;
