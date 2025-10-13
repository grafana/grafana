import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Input } from '../Input/Input';

import { InlineToast as InlineToastImpl, InlineToastProps } from './InlineToast';
import mdx from './InlineToast.mdx';

const story: Meta = {
  title: 'InlineToast',
  component: InlineToastImpl,
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

export const InlineToast: StoryFn<InlineToastProps> = (args) => {
  const [el, setEl] = useState<null | HTMLInputElement>(null);

  return (
    <div style={{ maxWidth: 500, width: `calc(100% - 100px)` }}>
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

export const WithAButton: StoryFn<InlineToastProps> = () => {
  return (
    <ClipboardButton icon="copy" getText={() => 'hello world'}>
      Copy surprise
    </ClipboardButton>
  );
};

WithAButton.parameters = {
  controls: { hideNoControlsWarning: true },
};
