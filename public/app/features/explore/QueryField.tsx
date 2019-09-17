import _ from 'lodash';
import React, { Context } from 'react';

import { Value, Editor as CoreEditor } from 'slate';
import { Editor, Plugin } from '@grafana/slate-react';
import Plain from 'slate-plain-serializer';
import classnames from 'classnames';

import { CompletionItemGroup, TypeaheadOutput } from 'app/types/explore';

import ClearPlugin from './slate-plugins/clear';
import NewlinePlugin from './slate-plugins/newline';
import SelectionShortcutsPlugin from './slate-plugins/selection_shortcuts';
import IndentationPlugin from './slate-plugins/indentation';
import ClipboardPlugin from './slate-plugins/clipboard';
import RunnerPlugin from './slate-plugins/runner';
import SuggestionsPlugin, { SuggestionsState } from './slate-plugins/suggestions';

import { Typeahead } from './Typeahead';

import { makeValue, SCHEMA } from '@grafana/ui';

export const HIGHLIGHT_WAIT = 500;

export interface QueryFieldProps {
  additionalPlugins?: Plugin[];
  cleanText?: (text: string) => string;
  disabled?: boolean;
  initialQuery: string | null;
  onRunQuery?: () => void;
  onChange?: (value: string) => void;
  onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>;
  onWillApplySuggestion?: (suggestion: string, state: SuggestionsState) => string;
  placeholder?: string;
  portalOrigin?: string;
  syntax?: string;
  syntaxLoaded?: boolean;
}

export interface QueryFieldState {
  suggestions: CompletionItemGroup[];
  typeaheadContext: string | null;
  typeaheadPrefix: string;
  typeaheadText: string;
  value: Value;
  lastExecutedValue: Value;
}

export interface TypeaheadInput {
  prefix: string;
  selection?: Selection;
  text: string;
  value: Value;
  wrapperClasses: string[];
  labelKey?: string;
}

/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions, see PromQueryField.tsx as an example.
 */
export class QueryField extends React.PureComponent<QueryFieldProps, QueryFieldState> {
  menuEl: HTMLElement | null;
  plugins: Plugin[];
  resetTimer: NodeJS.Timer;
  mounted: boolean;
  updateHighlightsTimer: Function;
  editor: Editor;
  typeaheadRef: Typeahead;

  constructor(props: QueryFieldProps, context: Context<any>) {
    super(props, context);

    this.updateHighlightsTimer = _.debounce(this.updateLogsHighlights, HIGHLIGHT_WAIT);

    const { onTypeahead, cleanText, portalOrigin, onWillApplySuggestion } = props;

    // Base plugins
    this.plugins = [
      SuggestionsPlugin({ onTypeahead, cleanText, portalOrigin, onWillApplySuggestion, component: this }),
      ClearPlugin(),
      RunnerPlugin({ handler: this.executeOnChangeAndRunQueries }),
      NewlinePlugin(),
      SelectionShortcutsPlugin(),
      IndentationPlugin(),
      ClipboardPlugin(),
      ...(props.additionalPlugins || []),
    ].filter(p => p);

    this.state = {
      suggestions: [],
      typeaheadContext: null,
      typeaheadPrefix: '',
      typeaheadText: '',
      value: makeValue(props.initialQuery || '', props.syntax),
      lastExecutedValue: null,
    };
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.resetTimer);
  }

  componentDidUpdate(prevProps: QueryFieldProps, prevState: QueryFieldState) {
    const { initialQuery, syntax } = this.props;
    const { value } = this.state;

    // if query changed from the outside
    if (initialQuery !== prevProps.initialQuery) {
      // and we have a version that differs
      if (initialQuery !== Plain.serialize(value)) {
        this.setState({ value: makeValue(initialQuery || '', syntax) });
      }
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: QueryFieldProps) {
    if (nextProps.syntaxLoaded && !this.props.syntaxLoaded) {
      // Need a bogus edit to re-render the editor after syntax has fully loaded
      const editor = this.editor.insertText(' ').deleteBackward(1);
      this.onChange(editor.value, true);
    }
  }

  onChange = (value: Value, invokeParentOnValueChanged?: boolean) => {
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

  handleBlur = (event: Event, editor: CoreEditor, next: Function) => {
    const { lastExecutedValue } = this.state;
    const previousValue = lastExecutedValue ? Plain.serialize(this.state.lastExecutedValue) : null;
    const currentValue = Plain.serialize(editor.value);

    if (previousValue !== currentValue) {
      this.executeOnChangeAndRunQueries();
    }

    editor.blur();

    return next();
  };

  render() {
    const { disabled } = this.props;
    const wrapperClassName = classnames('slate-query-field__wrapper', {
      'slate-query-field__wrapper--disabled': disabled,
    });

    return (
      <div className={wrapperClassName}>
        <div className="slate-query-field">
          <Editor
            ref={editor => (this.editor = editor)}
            schema={SCHEMA}
            autoCorrect={false}
            readOnly={this.props.disabled}
            onBlur={this.handleBlur}
            // onKeyDown={this.onKeyDown}
            onChange={(change: { value: Value }) => {
              this.onChange(change.value, false);
            }}
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

export default QueryField;
