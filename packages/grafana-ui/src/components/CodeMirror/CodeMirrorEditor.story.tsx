import { autocompletion, CompletionContext } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { action } from '@storybook/addon-actions';
import { Meta, StoryFn } from '@storybook/react';
import { useMemo, useState } from 'react';

import { CodeMirrorEditor } from './CodeMirrorEditor';
import { createGenericTheme } from './styles';
import { SyntaxHighlightConfig, ThemeFactory } from './types';

const meta: Meta<typeof CodeMirrorEditor> = {
  title: 'Inputs/CodeMirrorEditor',
  component: CodeMirrorEditor,
  parameters: {
    controls: {
      exclude: ['themeFactory', 'highlighterFactory', 'autocompletion', 'extensions', 'onChange', 'onBlur'],
    },
    docs: {
      description: {
        component:
          '⚠️ **Work in progress.** API is unstable and will change without deprecation warnings. See the README for details.',
      },
    },
  },
};

export default meta;

// ---------------------------------------------------------------------------
// Basic
// ---------------------------------------------------------------------------

export const Basic: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState('Hello, CodeMirror!');
  return (
    <CodeMirrorEditor
      value={value}
      onChange={(v) => {
        setValue(v);
        action('onChange')(v);
      }}
      placeholder="Start typing..."
    />
  );
};

Basic.storyName = 'Basic';

// ---------------------------------------------------------------------------
// With syntax highlighting
// ---------------------------------------------------------------------------

const variableHighlightConfig: SyntaxHighlightConfig = {
  pattern: /\$\{[^}]+\}/g,
  className: 'cm-variable',
};

export const WithSyntaxHighlighting: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState('Visit ${__url} or open ${__url.path}');
  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      highlightConfig={variableHighlightConfig}
      placeholder="Type ${variable} patterns..."
    />
  );
};

WithSyntaxHighlighting.storyName = 'With syntax highlighting';

// ---------------------------------------------------------------------------
// With custom theme
// ---------------------------------------------------------------------------

const successTheme: ThemeFactory = (theme) => [
  createGenericTheme(theme),
  EditorView.theme({
    '.cm-variable': {
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium.toString(),
    },
  }),
];

export const WithCustomTheme: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState('Visit ${__url} or open ${__url.path}');
  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      themeFactory={successTheme}
      highlightConfig={variableHighlightConfig}
      placeholder="Custom theme applied to ${variables}"
    />
  );
};

WithCustomTheme.storyName = 'With custom theme';

// ---------------------------------------------------------------------------
// With autocompletion
// ---------------------------------------------------------------------------

const DEMO_COMPLETIONS = [
  { label: '${__series.name}', detail: 'Series name' },
  { label: '${__field.name}', detail: 'Field name' },
  { label: '${__value.raw}', detail: 'Raw cell value' },
  { label: '${__url}', detail: 'Current dashboard URL' },
];

export const WithAutocompletion: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState('');
  const autocompletionExt = useMemo(
    () =>
      autocompletion({
        override: [
          (ctx: CompletionContext) => {
            if (ctx.explicit) {
              return { from: ctx.pos, options: DEMO_COMPLETIONS };
            }
            const word = ctx.matchBefore(/\$\{?[\w.]*$/);
            if (!word) {
              return null;
            }
            return { from: word.from, options: DEMO_COMPLETIONS };
          },
        ],
        activateOnTyping: true,
        defaultKeymap: true,
      }),
    []
  );
  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      autocompletion={autocompletionExt}
      placeholder="Type $ or press Ctrl+Space for suggestions"
      closeBrackets={false}
    />
  );
};

WithAutocompletion.storyName = 'With autocompletion (type $ or Ctrl+Space)';

// ---------------------------------------------------------------------------
// With line numbers
// ---------------------------------------------------------------------------

const MULTILINE = `line one
line two
line three
line four
line five`;

export const WithLineNumbers: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState(MULTILINE);
  return <CodeMirrorEditor value={value} onChange={setValue} showLineNumbers={true} lineWrapping={false} />;
};

WithLineNumbers.storyName = 'With line numbers';

// ---------------------------------------------------------------------------
// With onBlur
// ---------------------------------------------------------------------------

export const WithOnBlur: StoryFn<typeof CodeMirrorEditor> = () => {
  const [value, setValue] = useState('Click away after editing to trigger onBlur');
  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      onBlur={(v) => action('onBlur')(v)}
      placeholder="Edit then click outside..."
    />
  );
};

WithOnBlur.storyName = 'With onBlur callback';

// ---------------------------------------------------------------------------
// Read-only
// ---------------------------------------------------------------------------

export const ReadOnly: StoryFn<typeof CodeMirrorEditor> = () => {
  const extensions = useMemo(() => [EditorView.editable.of(false)], []);
  return (
    <CodeMirrorEditor
      value="This content is read-only and cannot be edited."
      onChange={() => {}}
      extensions={extensions}
      useInputStyles={true}
      ariaLabel="Read-only code editor"
    />
  );
};

ReadOnly.storyName = 'Read-only (via extensions)';
