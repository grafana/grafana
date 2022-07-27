import { Meta, Story } from '@storybook/react';
import React, { useRef } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Input } from '../Input/Input';

import { InlineToast as InlineToastImpl, InlineToastProps } from './InlineToast';
import mdx from './InlineToast.mdx';

const story: Meta = {
  title: 'Indicator',
  component: InlineToastImpl,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default story;

export const InlineToast: Story<InlineToastProps> = (args) => {
  const ref = useRef<null | HTMLInputElement>(null);

  return (
    <div>
      <InlineToastImpl {...args} referenceElement={ref.current}>
        Copied
      </InlineToastImpl>
      <Input ref={ref} />
    </div>
  );
};

export const WithAButton: Story<InlineToastProps> = (args) => {
  return (
    <ClipboardButton icon="copy" getText={() => 'hello world'}>
      Copy surprise
    </ClipboardButton>
  );
};
