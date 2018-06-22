import React from 'react';
import ReactDOM from 'react-dom';
import { Value } from 'slate';
import { Editor } from 'slate-react';
import Plain from 'slate-plain-serializer';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from './utils/dom';
import BracesPlugin from './slate-plugins/braces';
import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';
import PluginPrism, { configurePrismMetricsTokens } from './slate-plugins/prism/index';
import RunnerPlugin from './slate-plugins/runner';
import debounce from './utils/debounce';
import { processLabels, RATE_RANGES, cleanText } from './utils/prometheus';

import Typeahead from './Typeahead';

const EMPTY_METRIC = '';
const TYPEAHEAD_DEBOUNCE = 300;

function flattenSuggestions(s) {
  return s ? s.reduce((acc, g) => acc.concat(g.items), []) : [];
}

const getInitialValue = query =>
  Value.fromJSON({
    document: {
      nodes: [
        {
          object: 'block',
          type: 'paragraph',
          nodes: [
            {
              object: 'text',
              leaves: [
                {
                  text: query,
                },
              ],
            },
          ],
        },
      ],
    },
  });

class Portal extends React.Component {
  node: any;
  constructor(props) {
    super(props);
    this.node = document.createElement('div');
    this.node.classList.add('explore-typeahead', `explore-typeahead-${props.index}`);
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

  constructor(props, context) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      ClearPlugin(),
      RunnerPlugin({ handler: props.onPressEnter }),
      NewlinePlugin(),
      PluginPrism(),
    ];

    this.state = {
      labelKeys: {},
      labelValues: {},
      metrics: props.metrics || [],
      suggestions: [],
      typeaheadIndex: 0,
      typeaheadPrefix: '',
      value: getInitialValue(props.initialQuery || ''),
    };
  }

  componentDidMount() {
    this.updateMenu();

    if (this.props.metrics === undefined) {
      this.fetchMetricNames();
    }
  }

  componentWillUnmount() {
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate() {
    this.updateMenu();
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.metrics && nextProps.metrics !== this.props.metrics) {
      this.setState({ metrics: nextProps.metrics }, this.onMetricsReceived);
    }
    // initialQuery is null in case the user typed
    if (nextProps.initialQuery !== null && nextProps.initialQuery !== this.props.initialQuery) {
      this.setState({ value: getInitialValue(nextProps.initialQuery) });
    }
  }

  onChange = ({ value }) => {
    const changed = value.document !== this.state.value.document;
    this.setState({ value }, () => {
      if (changed) {
        this.handleChangeQuery();
      }
    });

    window.requestAnimationFrame(this.handleTypeahead);
  };

  onMetricsReceived = () => {
    if (!this.state.metrics) {
      return;
    }
    configurePrismMetricsTokens(this.state.metrics);
    // Trigger re-render
    window.requestAnimationFrame(() => {
      // Bogus edit to trigger highlighting
      const change = this.state.value
        .change()
        .insertText(' ')
        .deleteBackward(1);
      this.onChange(change);
    });
  };

  request = url => {
    if (this.props.request) {
      return this.props.request(url);
    }
    return fetch(url);
  };

  handleChangeQuery = () => {
    // Send text change to parent
    const { onQueryChange } = this.props;
    if (onQueryChange) {
      onQueryChange(Plain.serialize(this.state.value));
    }
  };

  handleTypeahead = debounce(() => {
    const selection = window.getSelection();
    if (selection.anchorNode) {
      const wrapperNode = selection.anchorNode.parentElement;
      const editorNode = wrapperNode.closest('.query-field');
      if (!editorNode || this.state.value.isBlurred) {
        // Not inside this editor
        return;
      }

      const range = selection.getRangeAt(0);
      const text = selection.anchorNode.textContent;
      const offset = range.startOffset;
      const prefix = cleanText(text.substr(0, offset));

      // Determine candidates by context
      const suggestionGroups = [];
      const wrapperClasses = wrapperNode.classList;
      let typeaheadContext = null;

      // Take first metric as lucky guess
      const metricNode = editorNode.querySelector('.metric');

      if (wrapperClasses.contains('context-range')) {
        // Rate ranges
        typeaheadContext = 'context-range';
        suggestionGroups.push({
          label: 'Range vector',
          items: [...RATE_RANGES],
        });
      } else if (wrapperClasses.contains('context-labels') && metricNode) {
        const metric = metricNode.textContent;
        const labelKeys = this.state.labelKeys[metric];
        if (labelKeys) {
          if ((text && text.startsWith('=')) || wrapperClasses.contains('attr-value')) {
            // Label values
            const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
            if (labelKeyNode) {
              const labelKey = labelKeyNode.textContent;
              const labelValues = this.state.labelValues[metric][labelKey];
              typeaheadContext = 'context-label-values';
              suggestionGroups.push({
                label: 'Label values',
                items: labelValues,
              });
            }
          } else {
            // Label keys
            typeaheadContext = 'context-labels';
            suggestionGroups.push({ label: 'Labels', items: labelKeys });
          }
        } else {
          this.fetchMetricLabels(metric);
        }
      } else if (wrapperClasses.contains('context-labels') && !metricNode) {
        // Empty name queries
        const defaultKeys = ['job', 'instance'];
        // Munge all keys that we have seen together
        const labelKeys = Object.keys(this.state.labelKeys).reduce((acc, metric) => {
          return acc.concat(this.state.labelKeys[metric].filter(key => acc.indexOf(key) === -1));
        }, defaultKeys);
        if ((text && text.startsWith('=')) || wrapperClasses.contains('attr-value')) {
          // Label values
          const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
          if (labelKeyNode) {
            const labelKey = labelKeyNode.textContent;
            if (this.state.labelValues[EMPTY_METRIC]) {
              const labelValues = this.state.labelValues[EMPTY_METRIC][labelKey];
              typeaheadContext = 'context-label-values';
              suggestionGroups.push({
                label: 'Label values',
                items: labelValues,
              });
            } else {
              // Can only query label values for now (API to query keys is under development)
              this.fetchLabelValues(labelKey);
            }
          }
        } else {
          // Label keys
          typeaheadContext = 'context-labels';
          suggestionGroups.push({ label: 'Labels', items: labelKeys });
        }
      } else if (metricNode && wrapperClasses.contains('context-aggregation')) {
        typeaheadContext = 'context-aggregation';
        const metric = metricNode.textContent;
        const labelKeys = this.state.labelKeys[metric];
        if (labelKeys) {
          suggestionGroups.push({ label: 'Labels', items: labelKeys });
        } else {
          this.fetchMetricLabels(metric);
        }
      } else if (
        (this.state.metrics && ((prefix && !wrapperClasses.contains('token')) || text.match(/[+\-*/^%]/))) ||
        wrapperClasses.contains('context-function')
      ) {
        // Need prefix for metrics
        typeaheadContext = 'context-metrics';
        suggestionGroups.push({
          label: 'Metrics',
          items: this.state.metrics,
        });
      }

      let results = 0;
      const filteredSuggestions = suggestionGroups.map(group => {
        if (group.items) {
          group.items = group.items.filter(c => c.length !== prefix.length && c.indexOf(prefix) > -1);
          results += group.items.length;
        }
        return group;
      });

      console.log('handleTypeahead', selection.anchorNode, wrapperClasses, text, offset, prefix, typeaheadContext);

      this.setState({
        typeaheadPrefix: prefix,
        typeaheadContext,
        typeaheadText: text,
        suggestions: results > 0 ? filteredSuggestions : [],
      });
    }
  }, TYPEAHEAD_DEBOUNCE);

  applyTypeahead(change, suggestion) {
    const { typeaheadPrefix, typeaheadContext, typeaheadText } = this.state;

    // Modify suggestion based on context
    switch (typeaheadContext) {
      case 'context-labels': {
        const nextChar = getNextCharacter();
        if (!nextChar || nextChar === '}' || nextChar === ',') {
          suggestion += '=';
        }
        break;
      }

      case 'context-label-values': {
        // Always add quotes and remove existing ones instead
        if (!(typeaheadText.startsWith('="') || typeaheadText.startsWith('"'))) {
          suggestion = `"${suggestion}`;
        }
        if (getNextCharacter() !== '"') {
          suggestion = `${suggestion}"`;
        }
        break;
      }

      default:
    }

    this.resetTypeahead();

    // Remove the current, incomplete text and replace it with the selected suggestion
    let backward = typeaheadPrefix.length;
    const text = cleanText(typeaheadText);
    const suffixLength = text.length - typeaheadPrefix.length;
    const offset = typeaheadText.indexOf(typeaheadPrefix);
    const midWord = typeaheadPrefix && ((suffixLength > 0 && offset > -1) || suggestion === typeaheadText);
    const forward = midWord ? suffixLength + offset : 0;

    return (
      change
        // TODO this line breaks if cursor was moved left and length is longer than whole prefix
        .deleteBackward(backward)
        .deleteForward(forward)
        .insertText(suggestion)
        .focus()
    );
  }

  onKeyDown = (event, change) => {
    if (this.menuEl) {
      const { typeaheadIndex, suggestions } = this.state;

      switch (event.key) {
        case 'Escape': {
          if (this.menuEl) {
            event.preventDefault();
            this.resetTypeahead();
            return true;
          }
          break;
        }

        case 'Tab': {
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

        case 'ArrowDown': {
          // Select next suggestion
          event.preventDefault();
          this.setState({ typeaheadIndex: typeaheadIndex + 1 });
          break;
        }

        case 'ArrowUp': {
          // Select previous suggestion
          event.preventDefault();
          this.setState({ typeaheadIndex: Math.max(0, typeaheadIndex - 1) });
          break;
        }

        default: {
          // console.log('default key', event.key, event.which, event.charCode, event.locale, data.key);
          break;
        }
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

  async fetchLabelValues(key) {
    const url = `/api/v1/label/${key}/values`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const pairs = this.state.labelValues[EMPTY_METRIC];
      const values = {
        ...pairs,
        [key]: body.data,
      };
      // const labelKeys = {
      //   ...this.state.labelKeys,
      //   [EMPTY_METRIC]: keys,
      // };
      const labelValues = {
        ...this.state.labelValues,
        [EMPTY_METRIC]: values,
      };
      this.setState({ labelValues }, this.handleTypeahead);
    } catch (e) {
      if (this.props.onRequestError) {
        this.props.onRequestError(e);
      } else {
        console.error(e);
      }
    }
  }

  async fetchMetricLabels(name) {
    const url = `/api/v1/series?match[]=${name}`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const { keys, values } = processLabels(body.data);
      const labelKeys = {
        ...this.state.labelKeys,
        [name]: keys,
      };
      const labelValues = {
        ...this.state.labelValues,
        [name]: values,
      };
      this.setState({ labelKeys, labelValues }, this.handleTypeahead);
    } catch (e) {
      if (this.props.onRequestError) {
        this.props.onRequestError(e);
      } else {
        console.error(e);
      }
    }
  }

  async fetchMetricNames() {
    const url = '/api/v1/label/__name__/values';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      this.setState({ metrics: body.data }, this.onMetricsReceived);
    } catch (error) {
      if (this.props.onRequestError) {
        this.props.onRequestError(error);
      } else {
        console.error(error);
      }
    }
  }

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
      const rect = node.parentElement.getBoundingClientRect();
      menu.style.opacity = 1;
      menu.style.top = `${rect.top + window.scrollY + rect.height + 4}px`;
      menu.style.left = `${rect.left + window.scrollX - 2}px`;
    }
  };

  menuRef = el => {
    this.menuEl = el;
  };

  renderMenu = () => {
    const { suggestions } = this.state;
    const hasSuggesstions = suggestions && suggestions.length > 0;
    if (!hasSuggesstions) {
      return null;
    }

    // Guard selectedIndex to be within the length of the suggestions
    let selectedIndex = Math.max(this.state.typeaheadIndex, 0);
    const flattenedSuggestions = flattenSuggestions(suggestions);
    selectedIndex = selectedIndex % flattenedSuggestions.length || 0;
    const selectedKeys = flattenedSuggestions.length > 0 ? [flattenedSuggestions[selectedIndex]] : [];

    // Create typeahead in DOM root so we can later position it absolutely
    return (
      <Portal>
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
      <div className="query-field">
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
