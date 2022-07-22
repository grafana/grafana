import { Story, Meta } from '@storybook/react';
import React from 'react';

import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

import { ClipboardButton, Props } from './ClipboardButton';
import mdx from './ClipboardButton.mdx';

export default {
  title: 'Buttons/ClipboardButton',
  component: ClipboardButton,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['variant', 'icon', 'className', 'fullWidth', 'getText', 'onClipboardCopy', 'onClipboardError'],
    },
  },
} as Meta;

interface StoryProps extends Partial<Props> {
  inputText: string;
  buttonText: string;
}

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
            <ClipboardButton icon="copy" variant="primary" getText={() => shareUrl} {...args}>
              Copy
            </ClipboardButton>
          }
        />
      </Field>
    </div>
  );
};
