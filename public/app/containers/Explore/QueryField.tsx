import _ from 'lodash';
import React from 'react';
import ReactDOM from 'react-dom';
import { Block, Change, Document, Text, Value } from 'slate';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';

import BracesPlugin from './slate-plugins/braces';
import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';

import Typeahead from './Typeahead';

export const TYPEAHEAD_DEBOUNCE = 300;

function flattenSuggestions(s: any[]): any[] {
  return s ? s.reduce((acc, g) => acc.concat(g.items), []) : [];
}

export const makeFragment = (text: string): Document => {
  const lines = text.split('\n').map(line =>
    Block.create({
      type: 'paragraph',
      nodes: [Text.create(line)],
    })
  );

  const fragment = Document.create({
    nodes: lines,
  });
  return fragment;
};

export const getInitialValue = (value: string): Value => Value.create({ document: makeFragment(value) });

export interface Suggestion {
  display?: string;
  text: string;
  deleteBackwards?: number;
}

export interface SuggestionGroup {
  label: string;
  items: Suggestion[];
  prefixMatch?: boolean;
  skipFilter?: boolean;
}

interface TypeaheadFieldProps {
  additionalPlugins?: any[];
  cleanText: (text: string) => string;
  initialValue: string | null;
  onBlur?: () => void;
  onFocus?: () => void;
  onTypeahead?: (typeahead: TypeaheadInput) => TypeaheadOutput;
  onValueChanged?: (value: Value) => void;
  onWillApplySuggestion?: (suggestion: string, state: TypeaheadFieldState) => string;
  placeholder?: string;
  portalPrefix?: string;
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
  selection?: Selection;
  editorNode: Element;
  wrapperNode: Element;
  offset: number;
  text: string;
}

export interface TypeaheadOutput {
  context?: string;
  prefix: string;
  refresher?: Promise<{}>;
  suggestions: SuggestionGroup[];
}

class QueryField extends React.Component<TypeaheadFieldProps, TypeaheadFieldState> {
  menuEl: HTMLElement | null;
  plugins: any[];
  resetTimer: any;

  constructor(props, context) {
    super(props, context);

    // Base plugins
    this.plugins = [BracesPlugin(), ClearPlugin(), NewlinePlugin(), ...props.additionalPlugins];

    this.state = {
      suggestions: [],
      typeaheadContext: null,
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      typeaheadText: '',
      value: getInitialValue(props.initialValue || ''),
    };
  }

  componentDidMount() {
    this.updateMenu();
  }

  componentWillUnmount() {
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate() {
    this.updateMenu();
  }

  componentWillReceiveProps(nextProps) {
    // initialValue is null in case the user typed
    if (nextProps.initialValue !== null && nextProps.initialValue !== this.props.initialValue) {
      this.setState({ value: getInitialValue(nextProps.initialValue) });
    }
  }

  onChange = ({ value }) => {
    const changed = value.document !== this.state.value.document;
    this.setState({ value }, () => {
      if (changed) {
        this.handleChangeValue();
      }
    });

    if (changed) {
      window.requestAnimationFrame(this.handleTypeahead);
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
    const { onTypeahead } = this.props;

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

      const { suggestions, prefix, context, refresher } = onTypeahead({
        selection,
        editorNode,
        wrapperNode,
        offset,
        text,
      });

      const filteredSuggestions = suggestions.map(group => {
        if (group.items && prefix && !group.skipFilter) {
          group.items = group.items.filter(c => c.text.length >= prefix.length);
          if (group.prefixMatch) {
            group.items = group.items.filter(c => c.text.indexOf(prefix) === 0);
          } else {
            group.items = group.items.filter(c => c.text.indexOf(prefix) > -1);
          }
        }
        return group;
      });

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
    const { cleanText, onWillApplySuggestion } = this.props;
    const { typeaheadPrefix, typeaheadText } = this.state;
    let suggestionText = suggestion.display || suggestion.text;

    if (onWillApplySuggestion) {
      suggestionText = onWillApplySuggestion(suggestionText, { ...this.state });
    }

    this.resetTypeahead();

    // Remove the current, incomplete text and replace it with the selected suggestion
    const backward = suggestion.deleteBackwards || typeaheadPrefix.length;
    const text = cleanText(typeaheadText);
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestionText === typeaheadText);
    const forward = midWord ? suffixLength + offset : 0;

    // If new-lines, apply suggestion as block
    if (suggestionText.match(/\n/)) {
      const fragment = makeFragment(suggestionText);
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

      case 'Tab': {
        if (this.menuEl) {
          // Dont blur input
          event.preventDefault();
          if (!suggestions || suggestions.length === 0) {
            return undefined;
          }

          // Get the currently selected suggestion
          const flattenedSuggestions = flattenSuggestions(suggestions);
          const selected = Math.abs(typeaheadIndex);
          const selectedIndex = selected % flattenedSuggestions.length || 0;
          const suggestion = flattenedSuggestions[selectedIndex];

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

  handleClickMenu = item => {
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
    const hasSuggesstions = suggestions && suggestions.length > 0;
    if (!hasSuggesstions) {
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
    const { portalPrefix } = this.props;
    const { suggestions } = this.state;
    const hasSuggesstions = suggestions && suggestions.length > 0;
    if (!hasSuggesstions) {
      return null;
    }

    // Guard selectedIndex to be within the length of the suggestions
    let selectedIndex = Math.max(this.state.typeaheadIndex, 0);
    const flattenedSuggestions = flattenSuggestions(suggestions);
    selectedIndex = selectedIndex % flattenedSuggestions.length || 0;
    const selectedKeys = (flattenedSuggestions.length > 0 ? [flattenedSuggestions[selectedIndex]] : []).map(
      i => (typeof i === 'object' ? i.text : i)
    );

    // Create typeahead in DOM root so we can later position it absolutely
    return (
      <Portal prefix={portalPrefix}>
        <Typeahead
          menuRef={this.menuRef}
          selectedItems={selectedKeys}
          onClickItem={this.handleClickMenu}
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

class Portal extends React.Component<{ index?: number; prefix: string }, {}> {
  node: HTMLElement;

  constructor(props) {
    super(props);
    const { index = 0, prefix = 'query' } = props;
    this.node = document.createElement('div');
    this.node.classList.add(`slate-typeahead`, `slate-typeahead-${prefix}-${index}`);
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
