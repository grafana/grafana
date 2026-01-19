import { indentWithTab } from '@codemirror/commands';
import { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { debounce } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { CodeMirrorEditor } from '../CodeMirror/CodeMirrorEditor';
import { SyntaxHighlightConfig } from '../CodeMirror/types';

import { createRunQueryKeymap, createTabSpacesKeymap } from './codemirrorQueryFieldUtils';

export interface CodeMirrorQueryFieldProps {
  /**
   * The query value to display in the editor
   */
  query: string;

  /**
   * Called when the query changes (debounced by 500ms by default)
   */
  onChange?: (value: string) => void;

  /**
   * Called when the user requests to run the query (Shift+Enter or Ctrl+Enter)
   */
  onRunQuery?: () => void;

  /**
   * Called when the editor loses focus
   */
  onBlur?: () => void;

  /**
   * Placeholder text to display when the editor is empty
   */
  placeholder?: string;

  /**
   * Whether the editor is disabled
   */
  disabled?: boolean;

  /**
   * ARIA labelledby attribute for accessibility
   */
  'aria-labelledby'?: string;

  /**
   * Custom theme factory function
   */
  themeFactory?: (theme: GrafanaTheme2) => Extension;

  /**
   * Custom highlighter factory function
   */
  highlighterFactory?: (config?: SyntaxHighlightConfig) => Extension;

  /**
   * Configuration for the highlighter
   */
  highlightConfig?: SyntaxHighlightConfig;

  /**
   * CodeMirror autocompletion extension
   * Use autocompletion() from @codemirror/autocomplete to create this
   */
  autocompletion?: Extension;

  /**
   * Additional CodeMirror extensions
   */
  extensions?: Extension[];

  /**
   * Whether to show line numbers
   */
  showLineNumbers?: boolean;

  /**
   * Whether to enable line wrapping
   */
  lineWrapping?: boolean;

  /**
   * Custom CSS class name
   */
  className?: string;

  /**
   * Debounce delay for onChange in milliseconds
   * @default 500
   */
  debounceMs?: number;

  /**
   * Whether to run query on blur if value changed
   * @default true
   */
  runQueryOnBlur?: boolean;

  /**
   * Whether to use input styles from the theme
   * @default true
   */
  useInputStyles?: boolean;

  /**
   * Custom function to clean text before passing to onChange
   */
  cleanText?: (text: string) => string;

  /**
   * Number of spaces to insert when Tab key is pressed
   * Set to 0 to disable Tab key handling (use default browser behavior)
   * @default 2
   */
  tabSpaces?: number;

  /**
   * Whether to enable smart indentation on Tab key
   * When true, Tab will indent based on context (like most code editors)
   * When false, Tab will insert the number of spaces specified by tabSpaces
   * @default false
   */
  enableTabIndentation?: boolean;
}

/**
 * CodeMirrorQueryField is a modern replacement for the deprecated QueryField component.
 * It uses CodeMirror 6 instead of Slate and provides the same functionality:
 * - Syntax highlighting
 * - Autocompletion via CodeMirror extensions
 * - Query execution on Shift+Enter or Ctrl+Enter
 * - Debounced onChange
 * - Run query on blur if query changed
 */
export const CodeMirrorQueryField = memo((props: CodeMirrorQueryFieldProps) => {
  const {
    query,
    onChange,
    onRunQuery,
    onBlur,
    placeholder = '',
    disabled = false,
    'aria-labelledby': ariaLabelledby,
    themeFactory,
    highlighterFactory,
    highlightConfig,
    autocompletion,
    extensions = [],
    showLineNumbers = false,
    lineWrapping = true,
    className,
    debounceMs = 500,
    runQueryOnBlur = true,
    useInputStyles = true,
    cleanText,
    tabSpaces = 2,
    enableTabIndentation = false,
  } = props;

  // Track the last executed value to know if we should run query on blur
  const lastExecutedValueRef = useRef<string>(query);

  // Local state for the editor value (needed for blur detection)
  const [localValue, setLocalValue] = useState(query);

  // Clean text function - by default removes carriage returns
  const cleanTextFn = useMemo(() => cleanText || ((text: string) => text.replace(/\r/g, '')), [cleanText]);

  // Debounced onChange handler
  const debouncedOnChange = useMemo(
    () =>
      debounce((newValue: string) => {
        if (onChange) {
          onChange(cleanTextFn(newValue));
        }
      }, debounceMs),
    [onChange, debounceMs, cleanTextFn]
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedOnChange.cancel();
    };
  }, [debouncedOnChange]);

  // Handle onChange from CodeMirror
  const handleChange = useCallback(
    (newValue: string) => {
      setLocalValue(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange]
  );

  // Handle run query
  const handleRunQuery = useCallback(() => {
    // Cancel any pending debounced onChange
    debouncedOnChange.cancel();

    // Immediately call onChange with current value
    if (onChange) {
      onChange(cleanTextFn(localValue));
    }

    // Call onRunQuery
    if (onRunQuery) {
      onRunQuery();
      lastExecutedValueRef.current = localValue;
    }
  }, [onChange, onRunQuery, localValue, cleanTextFn, debouncedOnChange]);

  // Handle blur
  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    } else if (runQueryOnBlur) {
      // Run query by default on blur if value changed
      if (localValue !== lastExecutedValueRef.current) {
        handleRunQuery();
      }
    }
  }, [onBlur, runQueryOnBlur, localValue, handleRunQuery]);

  // Build extensions array
  const allExtensions = useMemo(() => {
    const exts: Extension[] = [...extensions];

    // Add run query keymap FIRST (before autocompletion) to give it higher priority
    // This ensures Shift+Enter runs the query instead of accepting autocomplete
    if (onRunQuery) {
      exts.push(createRunQueryKeymap(handleRunQuery));
    }

    // Add Tab key support
    // Priority: smart indentation > insert spaces > default behavior
    if (enableTabIndentation) {
      exts.push(keymap.of([indentWithTab]));
    } else if (tabSpaces > 0) {
      exts.push(createTabSpacesKeymap(tabSpaces));
    }

    // Add blur handler
    exts.push(
      EditorView.domEventHandlers({
        blur: () => {
          handleBlur();
          return false; // Allow other handlers to run
        },
      })
    );

    // Disable editor if disabled prop is true
    if (disabled) {
      exts.push(EditorView.editable.of(false));
    }

    return exts;
  }, [extensions, onRunQuery, handleRunQuery, handleBlur, disabled, enableTabIndentation, tabSpaces]);

  // Update local value when prop changes
  useEffect(() => {
    setLocalValue(query);
  }, [query]);

  return (
    <CodeMirrorEditor
      value={query}
      onChange={handleChange}
      placeholder={placeholder}
      themeFactory={themeFactory}
      highlighterFactory={highlighterFactory}
      highlightConfig={highlightConfig}
      autocompletion={autocompletion}
      extensions={allExtensions}
      showLineNumbers={showLineNumbers}
      lineWrapping={lineWrapping}
      ariaLabel={ariaLabelledby ? undefined : placeholder}
      className={className}
      useInputStyles={useInputStyles}
      closeBrackets={true}
    />
  );
});

CodeMirrorQueryField.displayName = 'CodeMirrorQueryField';
