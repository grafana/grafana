import PluginPrism from 'app/features/explore/slate-plugins/prism';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import ClearPlugin from 'app/features/explore/slate-plugins/clear';
import NewlinePlugin from 'app/features/explore/slate-plugins/newline';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';

import Typeahead from './typeahead';
import { getKeybindingSrv, KeybindingSrv } from 'app/core/services/keybindingSrv';

import { Block, Document, Text, Value } from 'slate';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';
import ReactDOM from 'react-dom';
import React from 'react';
import _ from 'lodash';

function flattenSuggestions(s) {
  return s ? s.reduce((acc, g) => acc.concat(g.items), []) : [];
}

export const makeFragment = text => {
  const lines = text.split('\n').map(line =>
    Block.create({
      type: 'paragraph',
      nodes: [Text.create(line)],
    } as any)
  );

  const fragment = Document.create({
    nodes: lines,
  });
  return fragment;
};

export const getInitialValue = query => Value.create({ document: makeFragment(query) });

class Portal extends React.Component<any, any> {
  node: any;

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

class QueryField extends React.Component<any, any> {
  menuEl: any;
  plugins: any;
  resetTimer: any;
  keybindingSrv: KeybindingSrv = getKeybindingSrv();

  constructor(props, context) {
    super(props, context);

    const { prismDefinition = {}, prismLanguage = 'kusto' } = props;

    this.plugins = [
      BracesPlugin(),
      ClearPlugin(),
      RunnerPlugin({ handler: props.onPressEnter }),
      NewlinePlugin(),
      PluginPrism({ definition: prismDefinition, language: prismLanguage }),
    ];

    this.state = {
      labelKeys: {},
      labelValues: {},
      suggestions: [],
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      value: getInitialValue(props.initialQuery || ''),
    };
  }

  componentDidMount() {
    this.updateMenu();
  }

  componentWillUnmount() {
    this.restoreEscapeKeyBinding();
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate() {
    this.updateMenu();
  }

  onChange = ({ value }) => {
    const changed = value.document !== this.state.value.document;
    this.setState({ value }, () => {
      if (changed) {
        // call typeahead only if query changed
        requestAnimationFrame(() => this.onTypeahead());
        this.onChangeQuery();
      }
    });
  };

  request = (url?) => {
    if (this.props.request) {
      return this.props.request(url);
    }
    return fetch(url);
  };

  onChangeQuery = () => {
    // Send text change to parent
    const { onQueryChange } = this.props;
    if (onQueryChange) {
      onQueryChange(Plain.serialize(this.state.value));
    }
  };

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
          this.onTypeahead(true);
          return true;
        }
        break;
      }

      case 'Tab':
      case 'Enter': {
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

  onTypeahead = (change?, item?) => {
    return change || this.state.value.change();
  };

  applyTypeahead(change?, suggestion?): { value: object } {
    return { value: {} };
  }

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
    this.restoreEscapeKeyBinding();
  };

  handleFocus = () => {
    const { onFocus } = this.props;
    if (onFocus) {
      onFocus();
    }
    // Don't go back to dashboard if Escape pressed inside the editor.
    this.removeEscapeKeyBinding();
  };

  removeEscapeKeyBinding() {
    this.keybindingSrv.unbind('esc', 'keydown');
  }

  restoreEscapeKeyBinding() {
    this.keybindingSrv.setupGlobal();
  }

  onClickItem = item => {
    const { suggestions } = this.state;
    if (!suggestions || suggestions.length === 0) {
      return;
    }

    // Get the currently selected suggestion
    const flattenedSuggestions = flattenSuggestions(suggestions);
    const suggestion: any = _.find(
      flattenedSuggestions,
      suggestion => suggestion.display === item || suggestion.text === item
    );

    // Manually triggering change
    const change = this.applyTypeahead(this.state.value.change(), suggestion);
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
    if (node && node.parentElement) {
      // Read from DOM
      const rect = node.parentElement.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const screenHeight = window.innerHeight;

      const menuLeft = rect.left + scrollX - 2;
      const menuTop = rect.top + scrollY + rect.height + 4;
      const menuHeight = screenHeight - menuTop - 10;

      // Write DOM
      requestAnimationFrame(() => {
        menu.style.opacity = 1;
        menu.style.top = `${menuTop}px`;
        menu.style.left = `${menuLeft}px`;
        menu.style.maxHeight = `${menuHeight}px`;
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
    const selectedKeys = (flattenedSuggestions.length > 0 ? [flattenedSuggestions[selectedIndex]] : []).map(i =>
      typeof i === 'object' ? i.text : i
    );

    // Create typeahead in DOM root so we can later position it absolutely
    return (
      <Portal prefix={portalPrefix}>
        <Typeahead
          menuRef={this.menuRef}
          selectedItems={selectedKeys}
          onClickItem={this.onClickItem}
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

export default QueryField;
