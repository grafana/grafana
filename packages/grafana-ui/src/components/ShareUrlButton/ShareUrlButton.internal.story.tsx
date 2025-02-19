import { StoryFn, Meta } from '@storybook/react';

import { ShareUrlButton as ShareUrlButtonImpl, Props } from './ShareUrlButton';
import mdx from './ShareUrlButton.mdx';

const meta: Meta = {
  title: 'Buttons/ShareUrlButton',
  component: ShareUrlButtonImpl,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['variant', 'icon', 'className', 'fullWidth', 'getText', 'onClipboardCopy', 'onClipboardError'],
    },
  },
};

interface StoryProps extends Partial<Props> {
  inputText: string;
  buttonText: string;
}

export const ShareUrlButton: StoryFn<StoryProps> = (args) => {
  return (
    <ShareUrlButtonImpl />
  );
};

export default meta;
