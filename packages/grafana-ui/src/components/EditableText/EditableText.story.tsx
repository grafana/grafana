import { Meta, StoryFn } from '@storybook/react';
import { useState } from 'react';

import { Switch } from '../Switch/Switch';

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
    text: 'Something Default',
  },
};

export const Basic: StoryFn<typeof EditableText> = (args) => {
  const handleTextChange = (text: string) => {
    console.log('Changed text:', text);
  };

  const [editable, setEditable] = useState(false);

  return (
    <div>
      <span>Editable: </span>
      <Switch label="Editable" value={editable} onChange={() => setEditable(!editable)} />
      <br />
      <EditableText {...args} editable={editable} textChangeHandler={handleTextChange} />
    </div>
  );
};

export default meta;
