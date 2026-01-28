# CodeMirror Editor Component

A reusable CodeMirror editor component for Grafana that provides a flexible and themeable code editing experience.

## Overview

The `CodeMirrorEditor` component is a generic, theme-aware editor built on CodeMirror 6. Use it anywhere you need code editing functionality with syntax highlighting, autocompletion, and Grafana theme integration.

## Basic usage

```typescript
import { CodeMirrorEditor } from '@grafana/ui';

function MyComponent() {
  const [value, setValue] = useState('');

  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      placeholder="Enter your code here"
    />
  );
}
```

## Advanced usage

### Custom syntax highlighting

Create a custom highlighter for your specific syntax:

```typescript
import { CodeMirrorEditor, SyntaxHighlightConfig } from '@grafana/ui';

function MyComponent() {
  const [value, setValue] = useState('');

  const highlightConfig: SyntaxHighlightConfig = {
    pattern: /\b(SELECT|FROM|WHERE)\b/gi, // Highlight SQL keywords
    className: 'cm-keyword',
  };

  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      highlightConfig={highlightConfig}
    />
  );
}
```

### Custom theme

Extend the default theme with your own styling:

```typescript
import { CodeMirrorEditor, ThemeFactory } from '@grafana/ui';
import { EditorView } from '@codemirror/view';
import { createGenericTheme } from '@grafana/ui';

const myCustomTheme: ThemeFactory = (theme) => {
  const baseTheme = createGenericTheme(theme);
  
  const customStyles = EditorView.theme({
    '.cm-keyword': {
      color: theme.colors.primary.text,
      fontWeight: theme.typography.fontWeightBold,
    },
    '.cm-string': {
      color: theme.colors.success.text,
    },
  });

  return [baseTheme, customStyles];
};

function MyComponent() {
  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      themeFactory={myCustomTheme}
    />
  );
}
```

### Custom autocompletion

Add autocompletion for your specific use case:

```typescript
import { CodeMirrorEditor } from '@grafana/ui';
import { autocompletion, CompletionContext } from '@codemirror/autocomplete';

function MyComponent() {
  const [value, setValue] = useState('');

  const autocompletionExtension = useMemo(() => {
    return autocompletion({
      override: [(context: CompletionContext) => {
        const word = context.matchBefore(/\w*/);
        if (!word || word.from === word.to) {
          return null;
        }

        return {
          from: word.from,
          options: [
            { label: 'hello', type: 'keyword' },
            { label: 'world', type: 'keyword' },
          ],
        };
      }],
      activateOnTyping: true,
    });
  }, []);

  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      autocompletion={autocompletionExtension}
    />
  );
}
```

### Additional extensions

Add custom CodeMirror extensions:

```typescript
import { CodeMirrorEditor } from '@grafana/ui';
import { javascript } from '@codemirror/lang-javascript';
import { linter } from '@codemirror/lint';

function MyComponent() {
  const extensions = useMemo(() => [
    javascript(),
    linter(/* your linting logic */),
  ], []);

  return (
    <CodeMirrorEditor
      value={value}
      onChange={setValue}
      extensions={extensions}
    />
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | The current value of the editor |
| `onChange` | `(value: string, callback?: () => void) => void` | required | Callback when the editor value changes |
| `placeholder` | `string` | `''` | Placeholder text when editor is empty |
| `themeFactory` | `ThemeFactory` | `createGenericTheme` | Custom theme factory function |
| `highlighterFactory` | `HighlighterFactory` | `createGenericHighlighter` | Custom syntax highlighter factory |
| `highlightConfig` | `SyntaxHighlightConfig` | `undefined` | Configuration for syntax highlighting |
| `autocompletion` | `Extension` | `undefined` | Custom autocompletion extension |
| `extensions` | `Extension[]` | `[]` | Additional CodeMirror extensions |
| `showLineNumbers` | `boolean` | `false` | Whether to show line numbers |
| `lineWrapping` | `boolean` | `true` | Whether to enable line wrapping |
| `ariaLabel` | `string` | `placeholder` | Aria label for accessibility |
| `className` | `string` | `undefined` | Custom CSS class for the container |
| `useInputStyles` | `boolean` | `true` | Whether to apply Grafana input styles |

## Example: DataLink editor

Here's how the DataLink component uses the CodeMirror editor:

```typescript
import { CodeMirrorEditor } from '@grafana/ui';
import { createDataLinkAutocompletion, createDataLinkHighlighter, createDataLinkTheme } from './codemirrorUtils';

export const DataLinkInput = memo(({ value, onChange, suggestions, placeholder }) => {
  const autocompletionExtension = useMemo(
    () => createDataLinkAutocompletion(suggestions), 
    [suggestions]
  );

  return (
    <CodeMirrorEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      themeFactory={createDataLinkTheme}
      highlighterFactory={createDataLinkHighlighter}
      autocompletion={autocompletionExtension}
      ariaLabel={placeholder}
    />
  );
});
```

## Utilities

### `createGenericTheme(theme: GrafanaTheme2): Extension`

Creates a generic CodeMirror theme based on Grafana's theme.

### `createGenericHighlighter(theme: GrafanaTheme2, config: SyntaxHighlightConfig): Extension`

Creates a generic syntax highlighter based on a regex pattern and CSS class name.

## Types

```typescript
interface SyntaxHighlightConfig {
  pattern: RegExp;
  className: string;
}

type ThemeFactory = (theme: GrafanaTheme2) => Extension;
type HighlighterFactory = (theme: GrafanaTheme2, config?: SyntaxHighlightConfig) => Extension;
type AutocompletionFactory<T = unknown> = (data: T) => Extension;
```

## Features

- **Theme-aware**: Automatically adapts to Grafana's light and dark themes
- **Syntax highlighting**: Configurable pattern-based syntax highlighting
- **Autocompletion**: Customizable autocompletion with keyboard shortcuts
- **Accessibility**: Built-in ARIA support
- **Line numbers**: Optional line number display
- **Line wrapping**: Configurable line wrapping
- **Modal-friendly**: Tooltips render at body level to prevent clipping
- **Extensible**: Support for custom CodeMirror extensions

## Best practices

1. **Memoize extensions**: Use `useMemo` to create autocompletion and other extensions to avoid recreating them on every render.

2. **Custom themes**: Extend the generic theme rather than replacing it to maintain consistency with Grafana's design system.

3. **Pattern efficiency**: Use efficient regex patterns for syntax highlighting to avoid performance issues with large documents.

4. **Accessibility**: Always provide meaningful `ariaLabel` or `placeholder` text for screen readers.

5. **Type safety**: Use the provided TypeScript types for better type safety and IDE support.
