import { Meta, StoryFn } from '@storybook/react';
import { useId, useState } from 'react';

import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

import { InlineToast as InlineToastImpl, InlineToastProps } from './InlineToast';
import mdx from './InlineToast.mdx';

const story: Meta = {
  title: 'Information/InlineToast',
  component: InlineToastImpl,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  argTypes: {
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
  const id = useId();

  return (
    <div style={{ maxWidth: 500, width: `calc(100% - 100px)` }}>
      <InlineToastImpl {...args} referenceElement={el}>
        Saved
      </InlineToastImpl>
      <Field label="Input with InlineToast">
        <Input ref={setEl} id={id} />
      </Field>
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
