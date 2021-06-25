import React, { useState } from 'react';
import { Story, Meta } from '@storybook/react';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { ClipboardButton, Props } from './ClipboardButton';
import { Input } from '../Forms/Legacy/Input/Input';
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
      exclude: ['size', 'variant', 'icon', 'className', 'fullWidth'],
    },
  },
} as Meta;

interface StoryProps extends Partial<Props> {
  inputText: string;
  buttonText: string;
}

const Wrapper: Story<StoryProps> = (args) => {
  const [copyMessage, setCopyMessage] = useState('');
  const clipboardCopyMessage = 'Value copied to clipboard';
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', width: '100%', marginBottom: '1em' }}>
        <ClipboardButton
          variant="secondary"
          getText={() => args.inputText}
          onClipboardCopy={() => setCopyMessage(clipboardCopyMessage)}
        >
          {args.buttonText}
        </ClipboardButton>
        <Input value={args.inputText} onChange={() => {}} />
      </div>
      <span>{copyMessage}</span>
    </div>
  );
};
export const CopyToClipboard = Wrapper.bind({});
CopyToClipboard.args = {
  inputText: 'go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only',
  buttonText: 'Copy to clipboard',
};
