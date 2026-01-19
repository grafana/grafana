import { autocompletion, CompletionContext } from '@codemirror/autocomplete';
import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { useState, useId, useMemo } from 'react';

import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';

import { CodeMirrorQueryField } from './CodeMirrorQueryField';

const meta: Meta<typeof CodeMirrorQueryField> = {
  title: 'Inputs/CodeMirrorQueryField',
  component: CodeMirrorQueryField,
  parameters: {
    controls: {
      exclude: [
        'autocompletion',
        'onChange',
        'onBlur',
        'onRunQuery',
        'themeFactory',
        'highlighterFactory',
        'highlightConfig',
        'extensions',
        'cleanText',
        'aria-labelledby',
      ],
    },
  },
  argTypes: {
    query: {
      control: 'text',
    },
    placeholder: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
    showLineNumbers: {
      control: 'boolean',
    },
    lineWrapping: {
      control: 'boolean',
    },
    debounceMs: {
      control: 'number',
    },
    runQueryOnBlur: {
      control: 'boolean',
    },
    useInputStyles: {
      control: 'boolean',
    },
  },
};

export default meta;

/**
 * Basic usage of CodeMirrorQueryField
 */
export const Basic: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query, setQuery] = useState(args.query || 'SELECT * FROM table');
  const id = useId();

  return (
    <Field label={<Label id={id}>Query field (CodeMirror)</Label>}>
      <CodeMirrorQueryField
        {...args}
        query={query}
        onChange={(newValue) => {
          setQuery(newValue);
          action('onChange')(newValue);
        }}
        onRunQuery={() => {
          action('onRunQuery')(query);
        }}
        aria-labelledby={id}
      />
    </Field>
  );
};

Basic.args = {
  placeholder: 'Enter your query here...',
  disabled: false,
  showLineNumbers: false,
  lineWrapping: true,
  debounceMs: 500,
  runQueryOnBlur: true,
  useInputStyles: true,
};

/**
 * With autocompletion using CodeMirror's autocompletion() function
 */
export const WithAutocompletion: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query, setQuery] = useState('SELECT ');
  const id = useId();

  // Create autocompletion extension using CodeMirror's autocompletion() function
  const autocompletionExtension = useMemo(
    () =>
      autocompletion({
        override: [
          (context: CompletionContext) => {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) {
              return null;
            }

            return {
              from: word.from,
              options: [
                { label: 'SELECT', type: 'keyword', info: 'Select data from a table' },
                { label: 'FROM', type: 'keyword', info: 'Specify the table' },
                { label: 'WHERE', type: 'keyword', info: 'Filter results' },
                { label: 'JOIN', type: 'keyword', info: 'Join tables' },
                { label: 'GROUP BY', type: 'keyword', info: 'Group results' },
                { label: 'ORDER BY', type: 'keyword', info: 'Sort results' },
                { label: 'LIMIT', type: 'keyword', info: 'Limit number of results' },
                { label: 'users', type: 'class', info: 'User information table' },
                { label: 'orders', type: 'class', info: 'Order data table' },
                { label: 'products', type: 'class', info: 'Product catalog table' },
                { label: 'COUNT()', type: 'function', info: 'Count rows' },
                { label: 'SUM()', type: 'function', info: 'Sum values' },
                { label: 'AVG()', type: 'function', info: 'Average values' },
                { label: 'MAX()', type: 'function', info: 'Maximum value' },
                { label: 'MIN()', type: 'function', info: 'Minimum value' },
              ],
            };
          },
        ],
      }),
    []
  );

  return (
    <div>
      <Field
        label={<Label id={id}>Query field with autocompletion</Label>}
        description="Type to see suggestions. Press Ctrl+Space for explicit completion."
      >
        <CodeMirrorQueryField
          {...args}
          query={query}
          onChange={(newValue) => {
            setQuery(newValue);
            action('onChange')(newValue);
          }}
          onRunQuery={() => {
            action('onRunQuery')(query);
          }}
          autocompletion={autocompletionExtension}
          aria-labelledby={id}
        />
      </Field>
    </div>
  );
};

WithAutocompletion.args = {
  placeholder: 'Start typing to see suggestions...',
  disabled: false,
  showLineNumbers: false,
  lineWrapping: true,
};

/**
 * With line numbers and custom styling
 */
export const WithLineNumbers: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [value, setvalue] = useState(`SELECT id, name, email\nFROM users\nWHERE active = true\nORDER BY name`);
  const id = useId();

  return (
    <Field label={<Label id={id}>Multi-line query with line numbers</Label>}>
      <CodeMirrorQueryField
        {...args}
        query={value}
        onChange={(newValue) => {
          setvalue(newValue);
          action('onChange')(newValue);
        }}
        onRunQuery={() => {
          action('onRunQuery')(value);
        }}
        aria-labelledby={id}
      />
    </Field>
  );
};

WithLineNumbers.args = {
  placeholder: 'Enter your query here...',
  disabled: false,
  showLineNumbers: true,
  lineWrapping: true,
};

/**
 * Disabled state
 */
export const Disabled: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query] = useState('SELECT * FROM readonly_query');
  const id = useId();

  return (
    <Field label={<Label id={id}>Disabled query field</Label>}>
      <CodeMirrorQueryField
        {...args}
        query={query}
        onChange={action('onChange')}
        onRunQuery={action('onRunQuery')}
        aria-labelledby={id}
      />
    </Field>
  );
};

Disabled.args = {
  disabled: true,
  showLineNumbers: false,
  lineWrapping: true,
};

/**
 * Without line wrapping
 */
export const NoLineWrapping: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query, setQuery] = useState(
    'SELECT id, name, email, address, phone, created_at, updated_at FROM users WHERE active = true AND verified = true ORDER BY name ASC'
  );
  const id = useId();

  return (
    <Field
      label={<Label id={id}>Query without line wrapping</Label>}
      description="Long lines will require horizontal scrolling"
    >
      <CodeMirrorQueryField
        {...args}
        query={query}
        onChange={(newValue) => {
          setQuery(newValue);
          action('onChange')(newValue);
        }}
        onRunQuery={() => {
          action('onRunQuery')(query);
        }}
        aria-labelledby={id}
      />
    </Field>
  );
};

NoLineWrapping.args = {
  disabled: false,
  showLineNumbers: true,
  lineWrapping: false,
};

/**
 * Fast debounce for instant feedback
 */
export const FastDebounce: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query, setQuery] = useState('SELECT * FROM users');
  const [changeCount, setChangeCount] = useState(0);
  const id = useId();

  return (
    <div>
      <Field label={<Label id={id}>Fast debounce (100ms)</Label>} description={`onChange called ${changeCount} times`}>
        <CodeMirrorQueryField
          {...args}
          query={query}
          onChange={(newValue) => {
            setQuery(newValue);
            setChangeCount((count) => count + 1);
            action('onChange')(newValue);
          }}
          onRunQuery={() => {
            action('onRunQuery')(query);
          }}
          aria-labelledby={id}
        />
      </Field>
    </div>
  );
};

FastDebounce.args = {
  placeholder: 'Type to see fast onChange updates...',
  disabled: false,
  debounceMs: 100,
};
