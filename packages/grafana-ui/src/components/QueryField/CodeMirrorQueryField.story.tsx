import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { useState, useId } from 'react';

import { CompletionItemGroup, TypeaheadInput } from '../../types/completion';
import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';

import { CodeMirrorQueryField } from './CodeMirrorQueryField';

const meta: Meta<typeof CodeMirrorQueryField> = {
  title: 'Inputs/CodeMirrorQueryField',
  component: CodeMirrorQueryField,
  parameters: {
    controls: {
      exclude: [
        'onTypeahead',
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
 * With autocompletion (typeahead)
 */
export const WithAutocompletion: StoryFn<typeof CodeMirrorQueryField> = (args) => {
  const [query, setQuery] = useState('SELECT ');
  const id = useId();

  // Mock typeahead function that provides SQL keyword suggestions
  const handleTypeahead = async (input: TypeaheadInput): Promise<{ suggestions: CompletionItemGroup[] }> => {
    const suggestions: CompletionItemGroup[] = [
      {
        label: 'Keywords',
        items: [
          { label: 'SELECT', kind: 'keyword', documentation: 'Select data from a table' },
          { label: 'FROM', kind: 'keyword', documentation: 'Specify the table' },
          { label: 'WHERE', kind: 'keyword', documentation: 'Filter results' },
          { label: 'JOIN', kind: 'keyword', documentation: 'Join tables' },
          { label: 'GROUP BY', kind: 'keyword', documentation: 'Group results' },
          { label: 'ORDER BY', kind: 'keyword', documentation: 'Sort results' },
          { label: 'LIMIT', kind: 'keyword', documentation: 'Limit number of results' },
        ],
      },
      {
        label: 'Tables',
        items: [
          { label: 'users', kind: 'table', documentation: 'User information table' },
          { label: 'orders', kind: 'table', documentation: 'Order data table' },
          { label: 'products', kind: 'table', documentation: 'Product catalog table' },
        ],
      },
      {
        label: 'Functions',
        items: [
          { label: 'COUNT()', kind: 'function', documentation: 'Count rows' },
          { label: 'SUM()', kind: 'function', documentation: 'Sum values' },
          { label: 'AVG()', kind: 'function', documentation: 'Average values' },
          { label: 'MAX()', kind: 'function', documentation: 'Maximum value' },
          { label: 'MIN()', kind: 'function', documentation: 'Minimum value' },
        ],
      },
    ];

    return { suggestions };
  };

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
          onTypeahead={handleTypeahead}
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
