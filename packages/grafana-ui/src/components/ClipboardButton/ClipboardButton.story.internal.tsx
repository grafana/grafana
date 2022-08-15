import { Story, Meta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

import { ClipboardButton as ClipboardButtonImpl, Props } from './ClipboardButton';
import mdx from './ClipboardButton.mdx';

const meta: Meta = {
  title: 'Buttons/ClipboardButton',
  component: ClipboardButtonImpl,
  decorators: [withCenteredStory],
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

export const ClipboardButton: Story<StoryProps> = (args) => {
  const shareUrl = 'https://grafana.com/d/abcDEF-34t';

  return (
    <ClipboardButtonImpl icon="copy" variant="primary" getText={() => shareUrl} {...args}>
      Copy URL
    </ClipboardButtonImpl>
  );
};

export const AsInputFieldAddon: Story<StoryProps> = (args) => {
  const shareUrl = 'https://grafana.com/d/abcDEF-34t';

  return (
    <div style={{ width: '100%', maxWidth: 500 }}>
      <Field label="Link URL">
        <Input
          id="link-url-input"
          value={shareUrl}
          readOnly
          addonAfter={
            <ClipboardButtonImpl icon="copy" variant="primary" getText={() => shareUrl} {...args}>
              Copy
            </ClipboardButtonImpl>
          }
        />
      </Field>
    </div>
  );
};

export default meta;
