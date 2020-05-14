import React from 'react';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';

import { Editor as CoreEditor } from 'slate';
import { Plugin as SlatePlugin } from '@grafana/slate-react';

import TOKEN_MARK from './slate-prism/TOKEN_MARK';
import { Typeahead } from '../components/Typeahead/Typeahead';
import { CompletionItem, TypeaheadOutput, TypeaheadInput, SuggestionsState } from '../types/completion';
import { makeFragment } from '../utils/slate';

export const TYPEAHEAD_DEBOUNCE = 250;

// Commands added to the editor by this plugin.
interface SuggestionsPluginCommands {
  selectSuggestion: (suggestion: CompletionItem) => CoreEditor;
  applyTypeahead: (suggestion: CompletionItem) => CoreEditor;
}

export function SuggestionsPlugin({
  onTypeahead,
  cleanText,
  onWillApplySuggestion,
  portalOrigin,
}: {
  onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>;
  cleanText?: (text: string) => string;
  onWillApplySuggestion?: (suggestion: string, state: SuggestionsState) => string;
  portalOrigin: string;
}): SlatePlugin {
  let typeaheadRef: Typeahead;
  let state: SuggestionsState = {
    groupedItems: [],
    typeaheadPrefix: '',
    typeaheadContext: '',
    typeaheadText: '',
  };
  const handleTypeaheadDebounced = debounce(handleTypeahead, TYPEAHEAD_DEBOUNCE);

  const setState = (update: Partial<SuggestionsState>) => {
    state = {
      ...state,
      ...update,
    };
  };

  return {
    onBlur: (event, editor, next) => {
      state = {
        ...state,
        groupedItems: [],
      };

      return next();
    },

    onClick: (event, editor, next) => {
      state = {
        ...state,
        groupedItems: [],
      };

      return next();
    },

    onKeyDown: (event: Event, editor, next) => {
      const keyEvent = event as KeyboardEvent;
      const currentSuggestions = state.groupedItems;

      const hasSuggestions = currentSuggestions.length;

      switch (keyEvent.key) {
        case 'Escape': {
          if (hasSuggestions) {
            keyEvent.preventDefault();

            state = {
              ...state,
              groupedItems: [],
            };

            // Bogus edit to re-render editor
            return editor.insertText('');
          }

          break;
        }

        case 'ArrowDown':
        case 'ArrowUp':
          if (hasSuggestions) {
            keyEvent.preventDefault();
            typeaheadRef.moveMenuIndex(keyEvent.key === 'ArrowDown' ? 1 : -1);
            return;
          }

          break;

        case 'Enter': {
          if (!(keyEvent.shiftKey || keyEvent.ctrlKey) && hasSuggestions) {
            keyEvent.preventDefault();
            return typeaheadRef.insertSuggestion();
          }

          break;
        }

        case 'Tab': {
          if (hasSuggestions) {
            keyEvent.preventDefault();
            return typeaheadRef.insertSuggestion();
          }

          break;
        }

        default: {
          // Don't react on meta keys
          if (keyEvent.key.length === 1) {
            handleTypeaheadDebounced(editor, setState, onTypeahead, cleanText);
          }
          break;
        }
      }

      return next();
    },

    commands: {
      selectSuggestion: (editor: CoreEditor, suggestion: CompletionItem): CoreEditor => {
        const suggestions = state.groupedItems;
        if (!suggestions || !suggestions.length) {
          return editor;
        }

        // @ts-ignore
        const ed = editor.applyTypeahead(suggestion);
        handleTypeaheadDebounced(editor, setState, onTypeahead, cleanText);
        return ed;
      },

      applyTypeahead: (editor: CoreEditor, suggestion: CompletionItem): CoreEditor => {
        let suggestionText = suggestion.insertText || suggestion.label;

        const preserveSuffix = suggestion.kind === 'function';
        const move = suggestion.move || 0;

        const { typeaheadPrefix, typeaheadText, typeaheadContext } = state;

        if (onWillApplySuggestion) {
          suggestionText = onWillApplySuggestion(suggestionText, {
            groupedItems: state.groupedItems,
            typeaheadContext,
            typeaheadPrefix,
            typeaheadText,
          });
        }

        // Remove the current, incomplete text and replace it with the selected suggestion
        const backward = suggestion.deleteBackwards || typeaheadPrefix.length;
        const text = cleanText ? cleanText(typeaheadText) : typeaheadText;
        const suffixLength = text.length - typeaheadPrefix.length;
        const offset = typeaheadText.indexOf(typeaheadPrefix);
        const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
        const forward = midWord && !preserveSuffix ? suffixLength + offset : 0;

        // If new-lines, apply suggestion as block
        if (suggestionText.match(/\n/)) {
          const fragment = makeFragment(suggestionText);
          return editor
            .deleteBackward(backward)
            .deleteForward(forward)
            .insertFragment(fragment)
            .focus();
        }

        state = {
          ...state,
          groupedItems: [],
        };

        return editor
          .deleteBackward(backward)
          .deleteForward(forward)
          .insertText(suggestionText)
          .moveForward(move)
          .focus();
      },
    },

    renderEditor: (props, editor, next) => {
      if (editor.value.selection.isExpanded) {
        return next();
      }

      const children = next();

      return (
        <>
          {children}
          <Typeahead
            menuRef={(menu: Typeahead) => (typeaheadRef = menu)}
            origin={portalOrigin}
            prefix={state.typeaheadPrefix}
            isOpen={!!state.groupedItems.length}
            groupedItems={state.groupedItems}
            onSelectSuggestion={(editor as CoreEditor & SuggestionsPluginCommands).selectSuggestion}
          />
        </>
      );
    },
  };
}

const handleTypeahead = async (
  editor: CoreEditor,
  onStateChange: (state: Partial<SuggestionsState>) => void,
  onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>,
  cleanText?: (text: string) => string
): Promise<void> => {
  if (!onTypeahead) {
    return;
  }

  const { value } = editor;
  const { selection } = value;

  // Get decorations associated with the current line
  const parentBlock = value.document.getClosestBlock(value.focusBlock.key);
  const selectionStartOffset = value.selection.start.offset - 1;
  const decorations = parentBlock && parentBlock.getDecorations(editor as any);

  const filteredDecorations = decorations
    ? decorations
        .filter(
          decoration =>
            decoration!.start.offset <= selectionStartOffset &&
            decoration!.end.offset > selectionStartOffset &&
            decoration!.type === TOKEN_MARK
        )
        .toArray()
    : [];

  // Find the first label key to the left of the cursor
  const labelKeyDec =
    decorations &&
    decorations
      .filter(
        decoration =>
          decoration!.end.offset <= selectionStartOffset &&
          decoration!.type === TOKEN_MARK &&
          decoration!.data.get('className').includes('label-key')
      )
      .last();

  const labelKey = labelKeyDec && value.focusText.text.slice(labelKeyDec.start.offset, labelKeyDec.end.offset);

  const wrapperClasses = filteredDecorations
    .map(decoration => decoration.data.get('className'))
    .join(' ')
    .split(' ')
    .filter(className => className.length);

  let text = value.focusText.text;
  let prefix = text.slice(0, selection.focus.offset);

  if (filteredDecorations.length) {
    text = value.focusText.text.slice(filteredDecorations[0].start.offset, filteredDecorations[0].end.offset);
    prefix = value.focusText.text.slice(filteredDecorations[0].start.offset, selection.focus.offset);
  }

  // Label values could have valid characters erased if `cleanText()` is
  // blindly applied, which would undesirably interfere with suggestions
  const labelValueMatch = prefix.match(/(?:!?=~?"?|")(.*)/);
  if (labelValueMatch) {
    prefix = labelValueMatch[1];
  } else if (cleanText) {
    prefix = cleanText(prefix);
  }

  const { suggestions, context } = await onTypeahead({
    prefix,
    text,
    value,
    wrapperClasses,
    labelKey: labelKey || undefined,
    editor,
  });

  const filteredSuggestions = suggestions
    .map(group => {
      if (!group.items) {
        return group;
      }

      let newGroup = { ...group };
      if (prefix) {
        // Filter groups based on prefix
        if (!group.skipFilter) {
          newGroup.items = newGroup.items.filter(c => (c.filterText || c.label).length >= prefix.length);
          if (group.prefixMatch) {
            newGroup.items = newGroup.items.filter(c => (c.filterText || c.label).startsWith(prefix));
          } else {
            newGroup.items = newGroup.items.filter(c => (c.filterText || c.label).includes(prefix));
          }
        }

        // Filter out the already typed value (prefix) unless it inserts custom text not matching the prefix
        newGroup.items = newGroup.items.filter(c => !(c.insertText === prefix || (c.filterText ?? c.label) === prefix));
      }

      if (!group.skipSort) {
        newGroup.items = sortBy(newGroup.items, (item: CompletionItem) => item.sortText || item.label);
      }

      return newGroup;
    })
    .filter(gr => gr.items && gr.items.length); // Filter out empty groups

  onStateChange({
    groupedItems: filteredSuggestions,
    typeaheadPrefix: prefix,
    typeaheadContext: context,
    typeaheadText: text,
  });

  // Bogus edit to force re-render
  editor.blur().focus();
};
