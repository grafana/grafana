import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { EditableText } from './EditableText';
import mdx from './EditableText.mdx';

const meta: Meta<typeof EditableText> = {
  title: 'Forms/EditableText',
  component: EditableText,
  parameters: {
    docs: {
      page: mdx,
    },
  },
  args: {
    width: 30,
    value: 'Something Default',
  },
};

export const Basic: StoryFn<typeof EditableText> = (args) => {
  const [text, setText] = useState(args.value);
  const handleTextChange = (inputEvent: React.ChangeEvent<HTMLInputElement>) => {
    setText(inputEvent.currentTarget.value);
    console.log('Changed text:', inputEvent.currentTarget.value);
  };

  return <EditableText {...args} value={text} onChange={handleTextChange} />;
};

export default meta;
