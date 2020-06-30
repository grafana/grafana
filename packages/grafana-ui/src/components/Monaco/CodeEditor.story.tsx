import React from 'react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './CodeEditor.mdx';
import CodeEditor from './CodeEditor';

const getKnobs = () => {
  return {
    text: text('Body', 'SELECT * FROM table LIMIT 10'),
    language: text('Language', 'sql'),
  };
};

export default {
  title: 'CodeEditor',
  component: CodeEditor,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  const { text, language } = getKnobs();
  return (
    <CodeEditor
      value={text}
      language={language}
      onBlur={(text: string) => {
        console.log('Blur: ', text);
        action('code blur')(text);
      }}
      onSave={(text: string) => {
        console.log('Save: ', text);
        action('code saved')(text);
      }}
    />
  );
};
