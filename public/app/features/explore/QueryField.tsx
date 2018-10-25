import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { Change, Value } from 'slate';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';

import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';

import Typeahead from './Typeahead';
import { makeFragment, makeValue } from './Value';

export const TYPEAHEAD_DEBOUNCE = 100;

function getSuggestionByIndex(suggestions: SuggestionGroup[], index: number): Suggestion {
  // Flatten suggestion groups
  const flattenedSuggestions = suggestions.reduce((acc, g) => acc.concat(g.items), []);
  const correctedIndex = Math.max(index, 0) % flattenedSuggestions.length;
  return flattenedSuggestions[correctedIndex];
}

function hasSuggestions(suggestions: SuggestionGroup[]): boolean {
  return suggestions && suggestions.length > 0;
}

export interface Suggestion {
  /**
   * The label of this completion item. By default
   * this is also the text that is inserted when selecting
   * this completion.
   */
  label: string;
  /**
   * The kind of this completion item. Based on the kind
   * an icon is chosen by the editor.
   */
  kind?: string;
  /**
   * A human-readable string with additional information
   * about this item, like type or symbol information.
   */
  detail?: string;
  /**
   * A human-readable string, can be Markdown, that represents a doc-comment.
   */
  documentation?: string;
  /**
   * A string that should be used when comparing this item
   * with other items. When `falsy` the `label` is used.
   */
  sortText?: string;
  /**
   * A string that should be used when filtering a set of
   * completion items. When `falsy` the `label` is used.
   */
  filterText?: string;
  /**
   * A string or snippet that should be inserted in a document when selecting
   * this completion. When `falsy` the `label` is used.
   */
  insertText?: string;
  /**
   * Delete number of characters before the caret position,
   * by default the letters from the beginning of the word.
   */
  deleteBackwards?: number;
  /**
   * Number of steps to move after the insertion, can be negative.
   */
  move?: number;
}

export interface SuggestionGroup {
  /**
   * Label that will be displayed for all entries of this group.
   */
  label: string;
  /**
   * List of suggestions of this group.
   */
  items: Suggestion[];
  /**
   * If true, match only by prefix (and not mid-word).
   */
  prefixMatch?: boolean;
  /**
   * If true, do not filter items in this group based on the search.
   */
  skipFilter?: boolean;
  /**
   * If true, do not sort items.
   */
  skipSort?: boolean;
}

interface TypeaheadFieldProps {
  additionalPlugins?: any[];
  cleanText?: (text: string) => string;
  initialValue: string | null;
  onBlur?: () => void;
  onFocus?: () => void;
  onTypeahead?: (typeahead: TypeaheadInput) => TypeaheadOutput;
  onValueChanged?: (value: Value) => void;
  onWillApplySuggestion?: (suggestion: string, state: TypeaheadFieldState) => string;
  placeholder?: string;
  portalOrigin?: string;
  syntax?: string;
  syntaxLoaded?: boolean;
}

export interface TypeaheadFieldState {
  suggestions: SuggestionGroup[];
  typeaheadContext: string | null;
  typeaheadIndex: number;
  typeaheadPrefix: string;
  typeaheadText: string;
  value: Value;
}

export interface TypeaheadInput {
  editorNode: Element;
  prefix: string;
  selection?: Selection;
  text: string;
  value: Value;
  wrapperNode: Element;
}

export interface TypeaheadOutput {
  context?: string;
  refresher?: Promise<{}>;
  suggestions: SuggestionGroup[];
}

class QueryField extends React.PureComponent<TypeaheadFieldProps, TypeaheadFieldState> {
  menuEl: HTMLElement | null;
  plugins: any[];
  resetTimer: any;

  constructor(props, context) {
    super(props, context);

    // Base plugins
    this.plugins = [ClearPlugin(), NewlinePlugin(), ...props.additionalPlugins];

    this.state = {
      suggestions: [],
      typeaheadContext: null,
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      typeaheadText: '',
      value: makeValue(props.initialValue || '', props.syntax),
    };
  }

  componentDidMount() {
    this.updateMenu();
  }

  componentWillUnmount() {
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate(prevProps, prevState) {
    // Only update menu location when suggestion existence or text/selection changed
    if (
      this.state.value !== prevState.value ||
      hasSuggestions(this.state.suggestions) !== hasSuggestions(prevState.suggestions)
    ) {
      this.updateMenu();
    }
  }

  componentWillReceiveProps(nextProps: TypeaheadFieldProps) {
    if (nextProps.syntaxLoaded && !this.props.syntaxLoaded) {
      // Need a bogus edit to re-render the editor after syntax has fully loaded
      this.onChange(
        this.state.value
          .change()
          .insertText(' ')
          .deleteBackward()
      );
    }
  }

  onChange = ({ value }) => {
    const textChanged = value.document !== this.state.value.document;

    // Control editor loop, then pass text change up to parent
    this.setState({ value }, () => {
      if (textChanged) {
        this.handleChangeValue();
      }
    });

    // Show suggest menu on text input
    if (textChanged && value.selection.isCollapsed) {
      // Need one paint to allow DOM-based typeahead rules to work
      window.requestAnimationFrame(this.handleTypeahead);
    } else if (!this.resetTimer) {
      this.resetTypeahead();
    }
  };

  handleChangeValue = () => {
    // Send text change to parent
    const { onValueChanged } = this.props;
    if (onValueChanged) {
      onValueChanged(Plain.serialize(this.state.value));
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
              group.items = _.sortBy(group.items, item => item.sortText || item.label);
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

  applyTypeahead(change: Change, suggestion: Suggestion): Change {
    const { cleanText, onWillApplySuggestion, syntax } = this.props;
    const { typeaheadPrefix, typeaheadText } = this.state;
    let suggestionText = suggestion.insertText || suggestion.label;
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
    const forward = midWord ? suffixLength + offset : 0;

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

  onKeyDown = (event, change) => {
    const { typeaheadIndex, suggestions } = this.state;

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
      case 'Tab': {
        if (this.menuEl) {
          // Dont blur input
          event.preventDefault();
          if (!suggestions || suggestions.length === 0) {
            return undefined;
          }

          const suggestion = getSuggestionByIndex(suggestions, typeaheadIndex);
          this.applyTypeahead(change, suggestion);
          return true;
        }
        break;
      }

      case 'ArrowDown': {
        if (this.menuEl) {
          // Select next suggestion
          event.preventDefault();
          this.setState({ typeaheadIndex: typeaheadIndex + 1 });
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
    this.setState({
      suggestions: [],
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      typeaheadContext: null,
    });
    this.resetTimer = null;
  };

  handleBlur = () => {
    const { onBlur } = this.props;
    // If we dont wait here, menu clicks wont work because the menu
    // will be gone.
    this.resetTimer = setTimeout(this.resetTypeahead, 100);
    if (onBlur) {
      onBlur();
    }
  };

  handleFocus = () => {
    const { onFocus } = this.props;
    if (onFocus) {
      onFocus();
    }
  };

  onClickMenu = (item: Suggestion) => {
    // Manually triggering change
    const change = this.applyTypeahead(this.state.value.change(), item);
    this.onChange(change);
  };

  updateMenu = () => {
    const { suggestions } = this.state;
    const menu = this.menuEl;
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

  menuRef = el => {
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
        <Typeahead
          menuRef={this.menuRef}
          selectedItem={selectedItem}
          onClickItem={this.onClickMenu}
          prefix={typeaheadPrefix}
          groupedItems={suggestions}
        />
      </Portal>
    );
  };

  render() {
    return (
      <div className="slate-query-field">
        {this.renderMenu()}
        <Editor
          autoCorrect={false}
          onBlur={this.handleBlur}
          onKeyDown={this.onKeyDown}
          onChange={this.onChange}
          onFocus={this.handleFocus}
          placeholder={this.props.placeholder}
          plugins={this.plugins}
          spellCheck={false}
          value={this.state.value}
        />
      </div>
    );
  }
}

class Portal extends React.PureComponent<{ index?: number; origin: string }, {}> {
  node: HTMLElement;

  constructor(props) {
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
