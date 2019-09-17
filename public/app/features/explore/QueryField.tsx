import _ from 'lodash';
import React, { Context } from 'react';
import ReactDOM from 'react-dom';
// @ts-ignore
import { Change, Range, Value, Block } from 'slate';
// @ts-ignore
import { Editor } from 'slate-react';
// @ts-ignore
import Plain from 'slate-plain-serializer';
import classnames from 'classnames';
// @ts-ignore
import { isKeyHotkey } from 'is-hotkey';

import { CompletionItem, CompletionItemGroup, TypeaheadOutput } from 'app/types/explore';

import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';

import { TypeaheadWithTheme } from './Typeahead';
import { makeFragment, makeValue } from '@grafana/ui';

export const TYPEAHEAD_DEBOUNCE = 100;
export const HIGHLIGHT_WAIT = 500;
const SLATE_TAB = '  ';
const isIndentLeftHotkey = isKeyHotkey('mod+[');
const isIndentRightHotkey = isKeyHotkey('mod+]');
const isSelectLeftHotkey = isKeyHotkey('shift+left');
const isSelectRightHotkey = isKeyHotkey('shift+right');
const isSelectUpHotkey = isKeyHotkey('shift+up');
const isSelectDownHotkey = isKeyHotkey('shift+down');
const isSelectLineHotkey = isKeyHotkey('mod+l');

function getSuggestionByIndex(suggestions: CompletionItemGroup[], index: number): CompletionItem {
  // Flatten suggestion groups
  const flattenedSuggestions = suggestions.reduce((acc, g) => acc.concat(g.items), []);
  const correctedIndex = Math.max(index, 0) % flattenedSuggestions.length;
  return flattenedSuggestions[correctedIndex];
}

function hasSuggestions(suggestions: CompletionItemGroup[]): boolean {
  return suggestions && suggestions.length > 0;
}

export interface QueryFieldProps {
  additionalPlugins?: any[];
  cleanText?: (text: string) => string;
  disabled?: boolean;
  initialQuery: string | null;
  onRunQuery?: () => void;
  onChange?: (value: string) => void;
  onTypeahead?: (typeahead: TypeaheadInput) => TypeaheadOutput;
  onWillApplySuggestion?: (suggestion: string, state: QueryFieldState) => string;
  placeholder?: string;
  portalOrigin?: string;
  syntax?: string;
  syntaxLoaded?: boolean;
}

export interface QueryFieldState {
  suggestions: CompletionItemGroup[];
  typeaheadContext: string | null;
  typeaheadIndex: number;
  typeaheadPrefix: string;
  typeaheadText: string;
  value: any;
  lastExecutedValue: Value;
}

export interface TypeaheadInput {
  editorNode: Element;
  prefix: string;
  selection?: Selection;
  text: string;
  value: Value;
  wrapperNode: Element;
}

/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions, see PromQueryField.tsx as an example.
 */
export class QueryField extends React.PureComponent<QueryFieldProps, QueryFieldState> {
  menuEl: HTMLElement | null;
  plugins: any[];
  resetTimer: any;
  mounted: boolean;
  updateHighlightsTimer: any;

  constructor(props: QueryFieldProps, context: Context<any>) {
    super(props, context);

    this.updateHighlightsTimer = _.debounce(this.updateLogsHighlights, HIGHLIGHT_WAIT);

    // Base plugins
    this.plugins = [ClearPlugin(), NewlinePlugin(), ...(props.additionalPlugins || [])].filter(p => p);

    this.state = {
      suggestions: [],
      typeaheadContext: null,
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      typeaheadText: '',
      value: makeValue(props.initialQuery || '', props.syntax),
      lastExecutedValue: null,
    };
  }

  componentDidMount() {
    this.mounted = true;
    this.updateMenu();
  }

  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate(prevProps: QueryFieldProps, prevState: QueryFieldState) {
    const { initialQuery, syntax } = this.props;
    const { value, suggestions } = this.state;

    // if query changed from the outside
    if (initialQuery !== prevProps.initialQuery) {
      // and we have a version that differs
      if (initialQuery !== Plain.serialize(value)) {
        this.setState({ value: makeValue(initialQuery || '', syntax) });
      }
    }

    // Only update menu location when suggestion existence or text/selection changed
    if (value !== prevState.value || hasSuggestions(suggestions) !== hasSuggestions(prevState.suggestions)) {
      this.updateMenu();
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: QueryFieldProps) {
    if (nextProps.syntaxLoaded && !this.props.syntaxLoaded) {
      // Need a bogus edit to re-render the editor after syntax has fully loaded
      const change = this.state.value
        .change()
        .insertText(' ')
        .deleteBackward();

      this.onChange(change, true);
    }
  }

  onChange = ({ value }: Change, invokeParentOnValueChanged?: boolean) => {
    const documentChanged = value.document !== this.state.value.document;
    const prevValue = this.state.value;

    // Control editor loop, then pass text change up to parent
    this.setState({ value }, () => {
      if (documentChanged) {
        const textChanged = Plain.serialize(prevValue) !== Plain.serialize(value);
        if (textChanged && invokeParentOnValueChanged) {
          this.executeOnChangeAndRunQueries();
        }
        if (textChanged && !invokeParentOnValueChanged) {
          this.updateHighlightsTimer();
        }
      }
    });

    // Show suggest menu on text input
    if (documentChanged && value.selection.isCollapsed) {
      // Need one paint to allow DOM-based typeahead rules to work
      window.requestAnimationFrame(this.handleTypeahead);
    } else if (!this.resetTimer) {
      this.resetTypeahead();
    }
  };

  updateLogsHighlights = () => {
    const { onChange } = this.props;

    if (onChange) {
      onChange(Plain.serialize(this.state.value));
    }
  };

  executeOnChangeAndRunQueries = () => {
    // Send text change to parent
    const { onChange, onRunQuery } = this.props;
    if (onChange) {
      onChange(Plain.serialize(this.state.value));
    }

    if (onRunQuery) {
      onRunQuery();
      this.setState({ lastExecutedValue: this.state.value });
    }
  };

  handleTypeahead = _.debounce(async () => {
    const selection = window.getSelection();
    const { cleanText, onTypeahead } = this.props;
    const { value } = this.state;

    if (onTypeahead && selection.anchorNode) {
      const wrapperNode = selection.anchorNode.parentElement;
      const editorNode = wrapperNode.closest('.slate-query-field');
      if (!editorNode || this.state.value.isBlurred) {
        // Not inside this editor
        return;
      }

      const range = selection.getRangeAt(0);
      const offset = range.startOffset;
      const text = selection.anchorNode.textContent;
      let prefix = text.substr(0, offset);

      // Label values could have valid characters erased if `cleanText()` is
      // blindly applied, which would undesirably interfere with suggestions
      const labelValueMatch = prefix.match(/(?:!?=~?"?|")(.*)/);
      if (labelValueMatch) {
        prefix = labelValueMatch[1];
      } else if (cleanText) {
        prefix = cleanText(prefix);
      }

      const { suggestions, context, refresher } = onTypeahead({
        editorNode,
        prefix,
        selection,
        text,
        value,
        wrapperNode,
      });

      let filteredSuggestions = suggestions
        .map(group => {
          if (group.items) {
            if (prefix) {
              // Filter groups based on prefix
              if (!group.skipFilter) {
                group.items = group.items.filter(c => (c.filterText || c.label).length >= prefix.length);
                if (group.prefixMatch) {
                  group.items = group.items.filter(c => (c.filterText || c.label).indexOf(prefix) === 0);
                } else {
                  group.items = group.items.filter(c => (c.filterText || c.label).indexOf(prefix) > -1);
                }
              }
              // Filter out the already typed value (prefix) unless it inserts custom text
              group.items = group.items.filter(c => c.insertText || (c.filterText || c.label) !== prefix);
            }

            if (!group.skipSort) {
              group.items = _.sortBy(group.items, (item: CompletionItem) => item.sortText || item.label);
            }
          }
          return group;
        })
        .filter(group => group.items && group.items.length > 0); // Filter out empty groups

      // Keep same object for equality checking later
      if (_.isEqual(filteredSuggestions, this.state.suggestions)) {
        filteredSuggestions = this.state.suggestions;
      }

      this.setState(
        {
          suggestions: filteredSuggestions,
          typeaheadPrefix: prefix,
          typeaheadContext: context,
          typeaheadText: text,
        },
        () => {
          if (refresher) {
            refresher.then(this.handleTypeahead).catch(e => console.error(e));
          }
        }
      );
    }
  }, TYPEAHEAD_DEBOUNCE);

  applyTypeahead(change: Change, suggestion: CompletionItem): Change {
    const { cleanText, onWillApplySuggestion, syntax } = this.props;
    const { typeaheadPrefix, typeaheadText } = this.state;
    let suggestionText = suggestion.insertText || suggestion.label;
    const preserveSuffix = suggestion.kind === 'function';
    const move = suggestion.move || 0;

    if (onWillApplySuggestion) {
      suggestionText = onWillApplySuggestion(suggestionText, { ...this.state });
    }

    this.resetTypeahead();

    // Remove the current, incomplete text and replace it with the selected suggestion
    const backward = suggestion.deleteBackwards || typeaheadPrefix.length;
    const text = cleanText ? cleanText(typeaheadText) : typeaheadText;
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
    const forward = midWord && !preserveSuffix ? suffixLength + offset : 0;

    // If new-lines, apply suggestion as block
    if (suggestionText.match(/\n/)) {
      const fragment = makeFragment(suggestionText, syntax);
      return change
        .deleteBackward(backward)
        .deleteForward(forward)
        .insertFragment(fragment)
        .focus();
    }

    return change
      .deleteBackward(backward)
      .deleteForward(forward)
      .insertText(suggestionText)
      .move(move)
      .focus();
  }

  handleEnterKey = (event: KeyboardEvent, change: Change) => {
    event.preventDefault();

    if (event.shiftKey) {
      // pass through if shift is pressed
      return undefined;
    } else if (!this.menuEl) {
      this.executeOnChangeAndRunQueries();
      return true;
    } else {
      return this.selectSuggestion(change);
    }
  };

  selectSuggestion = (change: Change) => {
    const { typeaheadIndex, suggestions } = this.state;
    event.preventDefault();

    if (!suggestions || suggestions.length === 0) {
      return undefined;
    }

    const suggestion = getSuggestionByIndex(suggestions, typeaheadIndex);
    const nextChange = this.applyTypeahead(change, suggestion);

    const insertTextOperation = nextChange.operations.find((operation: any) => operation.type === 'insert_text');
    return insertTextOperation ? true : undefined;
  };

  handleTabKey = (change: Change): void => {
    const {
      startBlock,
      endBlock,
      selection: { startOffset, startKey, endOffset, endKey },
    } = change.value;

    if (this.menuEl) {
      this.selectSuggestion(change);
      return;
    }

    const first = startBlock.getFirstText();

    const startBlockIsSelected =
      startOffset === 0 && startKey === first.key && endOffset === first.text.length && endKey === first.key;

    if (startBlockIsSelected || !startBlock.equals(endBlock)) {
      this.handleIndent(change, 'right');
    } else {
      change.insertText(SLATE_TAB);
    }
  };

  handleIndent = (change: Change, indentDirection: 'left' | 'right') => {
    const curSelection = change.value.selection;
    const selectedBlocks = change.value.document.getBlocksAtRange(curSelection);

    if (indentDirection === 'left') {
      for (const block of selectedBlocks) {
        const blockWhitespace = block.text.length - block.text.trimLeft().length;

        const rangeProperties = {
          anchorKey: block.getFirstText().key,
          anchorOffset: blockWhitespace,
          focusKey: block.getFirstText().key,
          focusOffset: blockWhitespace,
        };

        // @ts-ignore
        const whitespaceToDelete = Range.create(rangeProperties);

        change.deleteBackwardAtRange(whitespaceToDelete, Math.min(SLATE_TAB.length, blockWhitespace));
      }
    } else {
      const { startText } = change.value;
      const textBeforeCaret = startText.text.slice(0, curSelection.startOffset);
      const isWhiteSpace = /^\s*$/.test(textBeforeCaret);

      for (const block of selectedBlocks) {
        change.insertTextByKey(block.getFirstText().key, 0, SLATE_TAB);
      }

      if (isWhiteSpace) {
        change.moveStart(-SLATE_TAB.length);
      }
    }
  };

  handleSelectVertical = (change: Change, direction: 'up' | 'down') => {
    const { focusBlock } = change.value;
    const adjacentBlock =
      direction === 'up'
        ? change.value.document.getPreviousBlock(focusBlock.key)
        : change.value.document.getNextBlock(focusBlock.key);

    if (!adjacentBlock) {
      return true;
    }
    const adjacentText = adjacentBlock.getFirstText();
    change.moveFocusTo(adjacentText.key, Math.min(change.value.anchorOffset, adjacentText.text.length)).focus();
    return true;
  };

  handleSelectUp = (change: Change) => this.handleSelectVertical(change, 'up');

  handleSelectDown = (change: Change) => this.handleSelectVertical(change, 'down');

  onKeyDown = (event: KeyboardEvent, change: Change) => {
    const { typeaheadIndex } = this.state;

    // Shortcuts
    if (isIndentLeftHotkey(event)) {
      event.preventDefault();
      this.handleIndent(change, 'left');
      return true;
    } else if (isIndentRightHotkey(event)) {
      event.preventDefault();
      this.handleIndent(change, 'right');
      return true;
    } else if (isSelectLeftHotkey(event)) {
      event.preventDefault();
      if (change.value.focusOffset > 0) {
        change.moveFocus(-1);
      }
      return true;
    } else if (isSelectRightHotkey(event)) {
      event.preventDefault();
      if (change.value.focusOffset < change.value.startText.text.length) {
        change.moveFocus(1);
      }
      return true;
    } else if (isSelectUpHotkey(event)) {
      event.preventDefault();
      this.handleSelectUp(change);
      return true;
    } else if (isSelectDownHotkey(event)) {
      event.preventDefault();
      this.handleSelectDown(change);
      return true;
    } else if (isSelectLineHotkey(event)) {
      event.preventDefault();
      const { focusBlock, document } = change.value;

      change.moveAnchorToStartOfBlock(focusBlock.key);

      const nextBlock = document.getNextBlock(focusBlock.key);
      if (nextBlock) {
        change.moveFocusToStartOfNextBlock();
      } else {
        change.moveFocusToEndOfText();
      }

      return true;
    }

    switch (event.key) {
      case 'Escape': {
        if (this.menuEl) {
          event.preventDefault();
          event.stopPropagation();
          this.resetTypeahead();
          return true;
        }
        break;
      }

      case ' ': {
        if (event.ctrlKey) {
          event.preventDefault();
          this.handleTypeahead();
          return true;
        }
        break;
      }

      case 'Enter':
        return this.handleEnterKey(event, change);

      case 'Tab': {
        event.preventDefault();
        return this.handleTabKey(change);
      }

      case 'ArrowDown': {
        if (this.menuEl) {
          // Select next suggestion
          event.preventDefault();
          const itemsCount =
            this.state.suggestions.length > 0
              ? this.state.suggestions.reduce((totalCount, current) => totalCount + current.items.length, 0)
              : 0;
          this.setState({ typeaheadIndex: Math.min(itemsCount - 1, typeaheadIndex + 1) });
        }
        break;
      }

      case 'ArrowUp': {
        if (this.menuEl) {
          // Select previous suggestion
          event.preventDefault();
          this.setState({ typeaheadIndex: Math.max(0, typeaheadIndex - 1) });
        }
        break;
      }

      default: {
        // console.log('default key', event.key, event.which, event.charCode, event.locale, data.key);
        break;
      }
    }
    return undefined;
  };

  resetTypeahead = () => {
    if (this.mounted) {
      this.setState({ suggestions: [], typeaheadIndex: 0, typeaheadPrefix: '', typeaheadContext: null });
      this.resetTimer = null;
    }
  };

  handleBlur = (event: FocusEvent, change: Change) => {
    const { lastExecutedValue } = this.state;
    const previousValue = lastExecutedValue ? Plain.serialize(this.state.lastExecutedValue) : null;
    const currentValue = Plain.serialize(change.value);

    // If we dont wait here, menu clicks wont work because the menu
    // will be gone.
    this.resetTimer = setTimeout(this.resetTypeahead, 100);

    if (previousValue !== currentValue) {
      this.executeOnChangeAndRunQueries();
    }
  };

  onClickMenu = (item: CompletionItem) => {
    // Manually triggering change
    const change = this.applyTypeahead(this.state.value.change(), item);
    this.onChange(change, true);
  };

  updateMenu = () => {
    const { suggestions } = this.state;
    const menu = this.menuEl;
    // Exit for unit tests
    if (!window.getSelection) {
      return;
    }
    const selection = window.getSelection();
    const node = selection.anchorNode;

    // No menu, nothing to do
    if (!menu) {
      return;
    }

    // No suggestions or blur, remove menu
    if (!hasSuggestions(suggestions)) {
      menu.removeAttribute('style');
      return;
    }

    // Align menu overlay to editor node
    if (node) {
      // Read from DOM
      const rect = node.parentElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      // Write DOM
      requestAnimationFrame(() => {
        menu.style.opacity = '1';
        menu.style.top = `${rect.top + scrollY + rect.height + 4}px`;
        menu.style.left = `${rect.left + scrollX - 2}px`;
      });
    }
  };

  menuRef = (el: HTMLElement) => {
    this.menuEl = el;
  };

  renderMenu = () => {
    const { portalOrigin } = this.props;
    const { suggestions, typeaheadIndex, typeaheadPrefix } = this.state;
    if (!hasSuggestions(suggestions)) {
      return null;
    }

    const selectedItem = getSuggestionByIndex(suggestions, typeaheadIndex);

    // Create typeahead in DOM root so we can later position it absolutely
    return (
      <Portal origin={portalOrigin}>
        <TypeaheadWithTheme
          menuRef={this.menuRef}
          selectedItem={selectedItem}
          onClickItem={this.onClickMenu}
          prefix={typeaheadPrefix}
          groupedItems={suggestions}
          typeaheadIndex={typeaheadIndex}
        />
      </Portal>
    );
  };

  getCopiedText(textBlocks: string[], startOffset: number, endOffset: number) {
    if (!textBlocks.length) {
      return undefined;
    }

    const excludingLastLineLength = textBlocks.slice(0, -1).join('').length + textBlocks.length - 1;
    return textBlocks.join('\n').slice(startOffset, excludingLastLineLength + endOffset);
  }

  handleCopy = (event: ClipboardEvent, change: Change) => {
    event.preventDefault();

    const { document, selection, startOffset, endOffset } = change.value;
    const selectedBlocks = document.getBlocksAtRangeAsArray(selection).map((block: Block) => block.text);

    const copiedText = this.getCopiedText(selectedBlocks, startOffset, endOffset);
    if (copiedText) {
      event.clipboardData.setData('Text', copiedText);
    }

    return true;
  };

  handlePaste = (event: ClipboardEvent, change: Change) => {
    event.preventDefault();
    const pastedValue = event.clipboardData.getData('Text');
    const lines = pastedValue.split('\n');

    if (lines.length) {
      change.insertText(lines[0]);
      for (const line of lines.slice(1)) {
        change.splitBlock().insertText(line);
      }
    }

    return true;
  };

  handleCut = (event: ClipboardEvent, change: Change) => {
    this.handleCopy(event, change);
    change.deleteAtRange(change.value.selection);

    return true;
  };

  render() {
    const { disabled } = this.props;
    const wrapperClassName = classnames('slate-query-field__wrapper', {
      'slate-query-field__wrapper--disabled': disabled,
    });
    return (
      <div className={wrapperClassName}>
        <div className="slate-query-field">
          {this.renderMenu()}
          <Editor
            autoCorrect={false}
            readOnly={this.props.disabled}
            onBlur={this.handleBlur}
            onKeyDown={this.onKeyDown}
            onChange={this.onChange}
            onCopy={this.handleCopy}
            onPaste={this.handlePaste}
            onCut={this.handleCut}
            placeholder={this.props.placeholder}
            plugins={this.plugins}
            spellCheck={false}
            value={this.state.value}
          />
        </div>
      </div>
    );
  }
}

interface PortalProps {
  index?: number;
  origin: string;
}

class Portal extends React.PureComponent<PortalProps, {}> {
  node: HTMLElement;

  constructor(props: PortalProps) {
    super(props);
    const { index = 0, origin = 'query' } = props;
    this.node = document.createElement('div');
    this.node.classList.add(`slate-typeahead`, `slate-typeahead-${origin}-${index}`);
    document.body.appendChild(this.node);
  }

  componentWillUnmount() {
    document.body.removeChild(this.node);
  }

  render() {
    return ReactDOM.createPortal(this.props.children, this.node);
  }
}

export default QueryField;
