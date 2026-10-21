import { type Meta, type StoryFn } from '@storybook/react';

import { SanitizedSVG } from './SanitizedSVG';
import mdx from './SanitizedSVG.mdx';

const meta: Meta<typeof SanitizedSVG> = {
  title: 'Iconography/SanitizedSVG',
  component: SanitizedSVG,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      include: ['src', 'cleanStyle', 'width', 'height'],
    },
  },
  args: {
    src: 'public/build/img/icons/unicons/cloud.svg',
    cleanStyle: false,
    width: 48,
    height: 48,
  },
};

export const Basic: StoryFn<typeof SanitizedSVG> = (args) => <SanitizedSVG {...args} />;

export const InlineMarkup: StoryFn<typeof SanitizedSVG> = (args) => <SanitizedSVG {...args} />;
InlineMarkup.args = {
  src: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><style>circle{fill:red}</style><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>',
};
InlineMarkup.parameters = {
  docs: {
    description: {
      story:
        'Markup passed as `src` is not a Grafana asset, so its `<style>` element is removed. The circle uses its `fill` attribute instead of the red style.',
    },
  },
};

export default meta;
