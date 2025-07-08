import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';

import { CodeEditor } from './CodeEditor';
import mdx from './CodeEditor.mdx';

const meta: Meta<typeof CodeEditor> = {
  title: 'Inputs/CodeEditor',
  component: CodeEditor,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['width', 'monacoOptions', 'onEditorDidMount', 'onBlur', 'onSave', 'getSuggestions', 'showLineNumbers'],
    },
  },
  argTypes: {
    height: { control: { type: 'range', min: 100, max: 800, step: 10 } },
    language: { control: { type: 'select' }, options: ['sql', 'json'] },
  },
};

export const Basic: StoryFn<typeof CodeEditor> = (args) => {
  return (
    <CodeEditor
      width="100%"
      height={args.height}
      value={args.value}
      language={args.language}
      onBlur={(text: string) => {
        action('code blur')(text);
      }}
      onSave={(text: string) => {
        action('code saved')(text);
      }}
      showLineNumbers={args.showLineNumbers}
      showMiniMap={args.showMiniMap}
      readOnly={args.readOnly}
    />
  );
};
Basic.args = {
  width: 300,
  height: 400,
  value: `CREATE TABLE Persons (
  PersonID int,
  LastName varchar(255),
  FirstName varchar(255),
  Address varchar(255),
  City varchar(255)
);
SELECT * FROM Persons LIMIT 10 '
  `,
  language: 'sql',
  showLineNumbers: false,
  showMiniMap: false,
  readOnly: false,
};

export default meta;
