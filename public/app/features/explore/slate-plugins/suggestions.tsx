import React from 'react';
import debounce from 'lodash/debounce';
import sortBy from 'lodash/sortBy';

import { Editor as CoreEditor } from 'slate';
import { Plugin as SlatePlugin } from '@grafana/slate-react';
import { TypeaheadOutput, CompletionItem, CompletionItemGroup } from 'app/types';

import { QueryField, TypeaheadInput } from '../QueryField';
import TOKEN_MARK from '@grafana/ui/src/slate-plugins/slate-prism/TOKEN_MARK';
import { TypeaheadWithTheme, Typeahead } from '../Typeahead';

import { makeFragment } from '@grafana/ui';

export const TYPEAHEAD_DEBOUNCE = 100;

export interface SuggestionsState {
  groupedItems: CompletionItemGroup[];
  typeaheadPrefix: string;
  typeaheadContext: string;
  typeaheadText: string;
}

let state: SuggestionsState = {
  groupedItems: [],
  typeaheadPrefix: '',
  typeaheadContext: '',
  typeaheadText: '',
};

export default function SuggestionsPlugin({
  onTypeahead,
  cleanText,
  onWillApplySuggestion,
  syntax,
  portalOrigin,
  component,
}: {
  onTypeahead: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>;
  cleanText?: (text: string) => string;
  onWillApplySuggestion?: (suggestion: string, state: SuggestionsState) => string;
  syntax?: string;
  portalOrigin: string;
  component: QueryField; // Need to attach typeaheadRef here
}): SlatePlugin {
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

    onKeyDown: (event: KeyboardEvent, editor, next) => {
      const currentSuggestions = state.groupedItems;

      const hasSuggestions = currentSuggestions.length;

      switch (event.key) {
        case 'Escape': {
          if (hasSuggestions) {
            event.preventDefault();

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
            event.preventDefault();
            component.typeaheadRef.moveMenuIndex(event.key === 'ArrowDown' ? 1 : -1);
            return;
          }

          break;

        case 'Enter':
        case 'Tab': {
          if (hasSuggestions) {
            event.preventDefault();

            component.typeaheadRef.insertSuggestion();
            return handleTypeahead(event, editor, onTypeahead, cleanText);
          }

          break;
        }

        default: {
          handleTypeahead(event, editor, onTypeahead, cleanText);
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
        return editor.applyTypeahead(suggestion);
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
          <TypeaheadWithTheme
            menuRef={(el: Typeahead) => (component.typeaheadRef = el)}
            origin={portalOrigin}
            prefix={state.typeaheadPrefix}
            isOpen={!!state.groupedItems.length}
            groupedItems={state.groupedItems}
            //@ts-ignore
            onSelectSuggestion={editor.selectSuggestion}
          />
        </>
      );
    },
  };
}

const handleTypeahead = debounce(
  async (
    event: Event,
    editor: CoreEditor,
    onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>,
    cleanText?: (text: string) => string
  ) => {
    if (!onTypeahead) {
      return null;
    }

    const { value } = editor;
    const { selection } = value;

    // Get decorations associated with the current line
    const parentBlock = value.document.getClosestBlock(value.focusBlock.key);
    const myOffset = value.selection.start.offset - 1;
    const decorations = parentBlock.getDecorations(editor as any);

    const filteredDecorations = decorations
      .filter(
        decoration =>
          decoration.start.offset <= myOffset && decoration.end.offset > myOffset && decoration.type === TOKEN_MARK
      )
      .toArray();

    const labelKeyDec = decorations
      .filter(
        decoration =>
          decoration.end.offset === myOffset &&
          decoration.type === TOKEN_MARK &&
          decoration.data.get('className').includes('label-key')
      )
      .first();

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
      labelKey,
    });

    const filteredSuggestions = suggestions
      .map(group => {
        if (!group.items) {
          return group;
        }

        if (prefix) {
          // Filter groups based on prefix
          if (!group.skipFilter) {
            group.items = group.items.filter(c => (c.filterText || c.label).length >= prefix.length);
            if (group.prefixMatch) {
              group.items = group.items.filter(c => (c.filterText || c.label).startsWith(prefix));
            } else {
              group.items = group.items.filter(c => (c.filterText || c.label).includes(prefix));
            }
          }

          // Filter out the already typed value (prefix) unless it inserts custom text
          group.items = group.items.filter(c => c.insertText || (c.filterText || c.label) !== prefix);
        }

        if (!group.skipSort) {
          group.items = sortBy(group.items, (item: CompletionItem) => item.sortText || item.label);
        }

        return group;
      })
      .filter(group => group.items && group.items.length); // Filter out empty groups

    state = {
      ...state,
      groupedItems: filteredSuggestions,
      typeaheadPrefix: prefix,
      typeaheadContext: context,
      typeaheadText: text,
    };

    // Bogus edit to force re-render
    return editor.blur().focus();
  },
  TYPEAHEAD_DEBOUNCE
);
