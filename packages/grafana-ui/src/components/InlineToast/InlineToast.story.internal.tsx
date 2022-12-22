import { Meta, Story } from '@storybook/react';
import React, { useState } from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Input } from '../Input/Input';

import { InlineToast as InlineToastImpl, InlineToastProps } from './InlineToast';
import mdx from './InlineToast.mdx';

const story: Meta = {
  title: 'InlineToast',
  component: InlineToastImpl,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
    // foo is the property we want to remove from the UI
    referenceElement: {
      table: {
        disable: true,
      },
    },
  },
};

export default story;

export const InlineToast: Story<InlineToastProps> = (args) => {
  const [el, setEl] = useState<null | HTMLInputElement>(null);

  return (
    <div>
      <InlineToastImpl {...args} referenceElement={el}>
        Saved
      </InlineToastImpl>
      <Input ref={setEl} />
    </div>
  );
};
InlineToast.args = {
  placement: 'right',
  suffixIcon: 'check',
};

export const WithAButton: Story<InlineToastProps> = () => {
  return (
    <ClipboardButton icon="copy" getText={() => 'hello world'}>
      Copy surprise
    </ClipboardButton>
  );
};

WithAButton.parameters = {
  controls: { hideNoControlsWarning: true },
};
