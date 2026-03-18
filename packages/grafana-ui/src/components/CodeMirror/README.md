# CodeMirrorEditor

> ⚠️ **WORK IN PROGRESS**
>
> This component is under active development. The API is unstable and **will change without notice or deprecation warnings**. Things may break at any time.

A reusable [CodeMirror 6](https://codemirror.net/) editor component for `@grafana/ui`. The long-term goal is to replace all ad-hoc editor usages in Grafana (Slate, inline Monaco) with a single, consistent, theme-aware editing primitive.

## Basic usage

```tsx
import { CodeMirrorEditor } from '@grafana/ui';

function MyComponent() {
  const [value, setValue] = useState('');

  return <CodeMirrorEditor value={value} onChange={setValue} placeholder="Enter text here" />;
}
```

## Extending the editor

### Custom syntax highlighting

Pass a `highlightConfig` with a global regex and a CSS class name. The generic highlighter applies `Decoration.mark` for every match:

```tsx
const highlightConfig: SyntaxHighlightConfig = {
  pattern: /\$\{[^}]+\}/g, // MUST have /g flag
  className: 'cm-variable',
};

<CodeMirrorEditor value={value} onChange={onChange} highlightConfig={highlightConfig} />;
```

For more control, supply a `highlighterFactory` function instead — it receives the `SyntaxHighlightConfig` and returns a CodeMirror `Extension`.

### Custom theme

Extend the base Grafana theme by providing a `themeFactory`:

```tsx
import { EditorView } from '@codemirror/view';
import { createGenericTheme } from '@grafana/ui';

const myTheme: ThemeFactory = (theme) => [
  createGenericTheme(theme),
  EditorView.theme({
    '.cm-variable': {
      color: theme.colors.success.text,
      fontWeight: theme.typography.fontWeightMedium,
    },
  }),
];

<CodeMirrorEditor value={value} onChange={onChange} themeFactory={myTheme} />;
```

### Custom autocompletion

Build a CodeMirror `autocompletion` extension and pass it via the `autocompletion` prop. Wrap in `useMemo` so the extension reference is stable:

```tsx
import { autocompletion, CompletionContext } from '@codemirror/autocomplete';

const myCompletion = useMemo(
  () =>
    autocompletion({
      override: [
        (ctx: CompletionContext) => {
          const word = ctx.matchBefore(/\w+/);
          if (!word) {
            return null;
          }
          return { from: word.from, options: [{ label: 'hello' }, { label: 'world' }] };
        },
      ],
      activateOnTyping: true,
    }),
  []
);

<CodeMirrorEditor value={value} onChange={onChange} autocompletion={myCompletion} />;
```

### Arbitrary CodeMirror extensions

Anything not covered by the named props can be added via the `extensions` array:

```tsx
import { EditorView } from '@codemirror/view';

const extensions = useMemo(() => [EditorView.editable.of(false)], []);

<CodeMirrorEditor value={value} onChange={onChange} extensions={extensions} />;
```

## Props

| Prop                 | Type                      | Default                    | Description                                     |
| -------------------- | ------------------------- | -------------------------- | ----------------------------------------------- |
| `value`              | `string`                  | required                   | Current editor content                          |
| `onChange`           | `(value: string) => void` | required                   | Fired on every document change                  |
| `onBlur`             | `(value: string) => void` | —                          | Fired when the editor loses focus               |
| `placeholder`        | `string`                  | `''`                       | Shown when the editor is empty                  |
| `themeFactory`       | `ThemeFactory`            | `createGenericTheme`       | Returns a CodeMirror theme Extension            |
| `highlighterFactory` | `HighlighterFactory`      | `createGenericHighlighter` | Returns a highlight Extension                   |
| `highlightConfig`    | `SyntaxHighlightConfig`   | —                          | Regex + class name for the default highlighter  |
| `autocompletion`     | `Extension`               | —                          | Full CodeMirror autocompletion extension        |
| `extensions`         | `Extension[]`             | `[]`                       | Extra CodeMirror extensions                     |
| `showLineNumbers`    | `boolean`                 | `false`                    | Show the line-number gutter                     |
| `lineWrapping`       | `boolean`                 | `true`                     | Wrap long lines                                 |
| `ariaLabel`          | `string`                  | `placeholder`              | Accessible label on the editor element          |
| `className`          | `string`                  | —                          | Extra CSS class on the outer container          |
| `useInputStyles`     | `boolean`                 | `true`                     | Apply Grafana input-box styles to the container |
| `closeBrackets`      | `boolean`                 | `true`                     | Auto-close brackets and quotes                  |
