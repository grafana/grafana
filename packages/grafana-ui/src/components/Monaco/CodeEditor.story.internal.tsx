import React from 'react';
import { number, text, boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import mdx from './CodeEditor.mdx';
import { CodeEditor } from './CodeEditorLazy';

const getKnobs = () => {
  const CONTAINER_GROUP = 'Container options';
  // ---
  const containerWidth = number(
    'Container width',
    300,
    {
      range: true,
      min: 100,
      max: 500,
      step: 10,
    },
    CONTAINER_GROUP
  );

  return {
    containerWidth,
    text: text('Body', 'SELECT * FROM table LIMIT 10'),
    language: text('Language', 'sql'),
    showLineNumbers: boolean('Show line numbers', false),
    showMiniMap: boolean('Show mini map', false),
    readOnly: boolean('readonly', false),
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
  const { containerWidth, text, language, showLineNumbers, showMiniMap, readOnly } = getKnobs();
  return (
    <CodeEditor
      width={containerWidth}
      height={400}
      value={text}
      language={language}
      onBlur={(text: string) => {
        action('code blur')(text);
      }}
      onSave={(text: string) => {
        action('code saved')(text);
      }}
      showLineNumbers={showLineNumbers}
      showMiniMap={showMiniMap}
      readOnly={readOnly}
    />
  );
};
