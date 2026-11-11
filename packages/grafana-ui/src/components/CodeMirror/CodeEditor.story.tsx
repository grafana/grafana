import type { Meta, StoryFn } from '@storybook/react';
import { useEffect, useState } from 'react';
import { action } from 'storybook/actions';

import mdx from './CodeEditor.mdx';
import { CodeMirrorEditor } from './CodeEditorLazy';
import { CODE_MIRROR_LANGUAGES } from './languages';
import type { CodeMirrorCompletionSource } from './types';

const keywordCompletionSource: CodeMirrorCompletionSource = (context) => {
  const word = context.matchBefore(/\w*/);

  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  return {
    from: word.from,
    options: [
      { label: 'SELECT', type: 'keyword' },
      { label: 'FROM', type: 'keyword' },
      { label: 'WHERE', type: 'keyword' },
      { label: 'LIMIT', type: 'keyword' },
      { label: 'grafana_metric', type: 'variable' },
      { label: 'grafana_logs', type: 'variable' },
    ],
  };
};

const meta: Meta<typeof CodeMirrorEditor> = {
  title: 'Inputs/CodeMirrorEditor',
  component: CodeMirrorEditor,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: [
        'onChange',
        'onBlur',
        'onSave',
        'completionSources',
        'signatureHelp',
        'variableSuggestions',
        'variableCompletionOptions',
        'loadingFallback',
      ],
    },
  },
  argTypes: {
    height: {
      control: 'text',
      description: 'Editor height, such as `200px`.',
      table: {
        defaultValue: { summary: '200px' },
      },
    },
    language: {
      control: { type: 'select' },
      description: 'Pass in a language to enable syntax highlighting and language-aware behavior.',
      options: Object.keys(CODE_MIRROR_LANGUAGES),
    },
    completionMode: {
      control: { type: 'inline-radio' },
      description: 'How custom completion sources interact with language-provided completions.',
      options: ['merge', 'override'],
      table: {
        defaultValue: { summary: 'merge' },
      },
    },
  },
};

const ControlledEditor: StoryFn<typeof CodeMirrorEditor> = (args) => {
  const [value, setValue] = useState(args.value);

  useEffect(() => {
    setValue(args.value);
  }, [args.value]);

  return (
    <CodeMirrorEditor
      {...args}
      value={value}
      aria-label={args['aria-label'] ?? 'Code editor'}
      onChange={(nextValue) => {
        setValue(nextValue);
        action('onChange')(nextValue);
      }}
      onBlur={(currentValue) => action('onBlur')(currentValue)}
      onSave={(currentValue) => action('onSave')(currentValue)}
    />
  );
};

export const Basic = ControlledEditor.bind({});
Basic.args = {
  value: `SELECT
  avg(value) AS cpu_usage
FROM grafana_metric
WHERE $__timeFilter(time)
LIMIT 100`,
  language: 'sql',
  height: '240px',
};

export const WithCompletions = ControlledEditor.bind({});
WithCompletions.args = {
  value: 'SEL',
  language: 'sql',
  height: '240px',
  completionMode: 'override',
  completionSources: [keywordCompletionSource],
};

export default meta;
