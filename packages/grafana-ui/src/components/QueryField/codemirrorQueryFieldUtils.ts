import { autocompletion, Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension, Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

import { CompletionItem, TypeaheadInput, TypeaheadOutput } from '../../types/completion';

/**
 * Creates a keymap extension that handles Tab key to insert spaces
 */
export function createTabSpacesKeymap(spaces: number): Extension {
  const spacesString = ' '.repeat(spaces);

  return keymap.of([
    {
      key: 'Tab',
      run: (view) => {
        view.dispatch({
          changes: {
            from: view.state.selection.main.from,
            to: view.state.selection.main.to,
            insert: spacesString,
          },
          selection: {
            anchor: view.state.selection.main.from + spaces,
          },
        });
        return true;
      },
    },
  ]);
}

/**
 * Creates a keymap extension that handles Enter key to run queries
 * Shift+Enter and Ctrl+Enter will run the query (matching the original QueryField behavior)
 * Plain Enter will insert a newline
 * Uses Prec.highest to ensure it takes priority over autocomplete keymaps
 */
export function createRunQueryKeymap(onRunQuery: () => void): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: 'Shift-Enter',
        run: () => {
          onRunQuery();
          return true;
        },
      },
      {
        key: 'Ctrl-Enter',
        run: () => {
          onRunQuery();
          return true;
        },
      },
    ])
  );
}

/**
 * Creates an autocompletion source function that uses the legacy onTypeahead callback
 * This bridges the old Slate-based typeahead system with CodeMirror's autocompletion
 *
 * @deprecated Use CodeMirror's native autocompletion API for new code
 * After migration this will be removed. Prefer CodeMirror's native autocompletion API.
 */
export function createTypeaheadAutocompletion(
  onTypeahead: (input: TypeaheadInput) => Promise<TypeaheadOutput>
): (context: CompletionContext) => Promise<CompletionResult | null> {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const { state, pos, explicit } = context;
    const doc = state.doc.toString();

    // Get the line content up to the cursor
    const line = state.doc.lineAt(pos);
    const lineText = line.text;
    const linePos = pos - line.from;

    // Get text before cursor on current line for prefix detection
    const textBeforeCursor = lineText.slice(0, linePos);

    // Try to find the prefix (word being typed)
    // Match word characters, dots, and special chars that might be part of syntax
    const prefixMatch = textBeforeCursor.match(/[\w.:]*$/);
    const prefix = prefixMatch ? prefixMatch[0] : '';

    // For explicit completion (Ctrl+Space), always try to get suggestions
    // For implicit, only if we have some prefix or are at a position that makes sense
    if (!explicit && !prefix) {
      return null;
    }

    try {
      // Call the legacy onTypeahead function
      const result = await onTypeahead({
        text: doc,
        prefix,
        wrapperClasses: [],
        // Note: We don't pass value and editor as they're Slate-specific
      });

      if (!result.suggestions || result.suggestions.length === 0) {
        return null;
      }

      // Convert all completion items from all groups to CodeMirror format
      const options: Completion[] = [];

      for (const group of result.suggestions) {
        // Add a group header if the group has a label
        if (group.label && group.items.length > 0) {
          options.push({
            label: group.label,
            type: 'header',
            apply: '',
          });
        }

        // Convert each item in the group
        for (const item of group.items) {
          options.push(convertCompletionItem(item));
        }
      }

      if (options.length === 0) {
        return null;
      }

      // Calculate the completion range
      // If there's a prefix, complete from the start of the prefix
      const from = prefix ? pos - prefix.length : pos;

      return {
        from,
        options,
        filter: false, // We let the onTypeahead function handle filtering
      };
    } catch (error) {
      console.error('Error in typeahead autocompletion:', error);
      return null;
    }
  };
}

/**
 * Converts a Slate-based CompletionItem to a CodeMirror Completion
 */
function convertCompletionItem(item: CompletionItem): Completion {
  return {
    label: item.label,
    type: item.kind,
    detail: item.detail,
    info: item.documentation,
    apply: item.insertText || item.label,
    // If deleteBackwards is specified, we need custom apply logic
    ...(item.deleteBackwards || item.move
      ? {
          apply: (view: EditorView, completion: Completion, from: number, to: number) => {
            const insertText = item.insertText || item.label;
            const deleteFrom = item.deleteBackwards ? from - item.deleteBackwards : from;
            const cursorPos = deleteFrom + insertText.length + (item.move || 0);

            view.dispatch({
              changes: { from: deleteFrom, to, insert: insertText },
              selection: { anchor: cursorPos },
            });
          },
        }
      : {}),
  };
}

/**
 * Creates an autocompletion extension configured for query fields using the legacy onTypeahead callback
 *
 * @deprecated Use CodeMirror's native autocompletion API for new code.
 * This utility is provided for backward compatibility during migration.
 * After migration this will be removed.
 *
 * @example
 * ```tsx
 * import { createQueryFieldAutocompletion } from '@grafana/ui';
 *
 * const autocompletion = useMemo(
 *   () => createQueryFieldAutocompletion(handleTypeahead),
 *   [handleTypeahead]
 * );
 *
 * <CodeMirrorQueryField
 *   query={query}
 *   onChange={setQuery}
 *   autocompletion={autocompletion}
 * />
 * ```
 */
export function createQueryFieldAutocompletion(
  onTypeahead: (input: TypeaheadInput) => Promise<TypeaheadOutput>
): Extension {
  return autocompletion({
    override: [createTypeaheadAutocompletion(onTypeahead)],
    activateOnTyping: true,
    closeOnBlur: true,
    maxRenderedOptions: 100,
    defaultKeymap: true,
    interactionDelay: 75, // Small delay to avoid too many calls while typing
  });
}
