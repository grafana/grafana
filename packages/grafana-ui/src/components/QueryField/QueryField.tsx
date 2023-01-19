import { css, cx } from '@emotion/css';
import classnames from 'classnames';
import { debounce } from 'lodash';
import React, { Context, PureComponent } from 'react';
import { Value } from 'slate';
import Plain from 'slate-plain-serializer';
import { Editor, EventHook, Plugin } from 'slate-react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import {
  makeValue,
  SCHEMA,
  CompletionItemGroup,
  TypeaheadOutput,
  TypeaheadInput,
  SuggestionsState,
  Themeable2,
} from '../..';
import {
  ClearPlugin,
  NewlinePlugin,
  SelectionShortcutsPlugin,
  IndentationPlugin,
  ClipboardPlugin,
  RunnerPlugin,
  SuggestionsPlugin,
} from '../../slate-plugins';
import { withTheme2 } from '../../themes';
import { getFocusStyles } from '../../themes/mixins';

export interface QueryFieldProps extends Themeable2 {
  additionalPlugins?: Plugin[];
  cleanText?: (text: string) => string;
  disabled?: boolean;
  // We have both value and local state. This is usually an antipattern but we need to keep local state
  // for perf reasons and also have outside value in for example in Explore redux that is mutable from logs
  // creating a two way binding.
  query?: string | null;
  onRunQuery?: () => void;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onRichValueChange?: (value: Value) => void;
  onClick?: EventHook<React.MouseEvent<Element, MouseEvent>>;
  onTypeahead?: (typeahead: TypeaheadInput) => Promise<TypeaheadOutput>;
  onWillApplySuggestion?: (suggestion: string, state: SuggestionsState) => string;
  placeholder?: string;
  portalOrigin: string;
  syntax?: string;
  syntaxLoaded?: boolean;
  theme: GrafanaTheme2;
}

export interface QueryFieldState {
  suggestions: CompletionItemGroup[];
  typeaheadContext: string | null;
  typeaheadPrefix: string;
  typeaheadText: string;
  value: Value;
}

/**
 * Renders an editor field.
 * Pass initial value as initialQuery and listen to changes in props.onValueChanged.
 * This component can only process strings. Internally it uses Slate Value.
 * Implement props.onTypeahead to use suggestions, see PromQueryField.tsx as an example.
 */
export class UnThemedQueryField extends PureComponent<QueryFieldProps, QueryFieldState> {
  plugins: Array<Plugin<Editor>>;
  runOnChangeDebounced: Function;
  lastExecutedValue: Value | null = null;
  mounted = false;
  editor: Editor | null = null;

  constructor(props: QueryFieldProps, context: Context<any>) {
    super(props, context);

    this.runOnChangeDebounced = debounce(this.runOnChange, 500);

    const { onTypeahead, cleanText, portalOrigin, onWillApplySuggestion } = props;

    // Base plugins
    this.plugins = [
      // SuggestionsPlugin and RunnerPlugin need to be before NewlinePlugin
      // because they override Enter behavior
      SuggestionsPlugin({ onTypeahead, cleanText, portalOrigin, onWillApplySuggestion }),
      RunnerPlugin({ handler: this.runOnChangeAndRunQuery }),
      NewlinePlugin(),
      ClearPlugin(),
      SelectionShortcutsPlugin(),
      IndentationPlugin(),
      ClipboardPlugin(),
      ...(props.additionalPlugins || []),
    ].filter((p) => p);

    this.state = {
      suggestions: [],
      typeaheadContext: null,
      typeaheadPrefix: '',
      typeaheadText: '',
      value: makeValue(props.query || '', props.syntax),
    };
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  componentDidUpdate(prevProps: QueryFieldProps, prevState: QueryFieldState) {
    const { query, syntax, syntaxLoaded } = this.props;

    if (!prevProps.syntaxLoaded && syntaxLoaded && this.editor) {
      // Need a bogus edit to re-render the editor after syntax has fully loaded
      const editor = this.editor.insertText(' ').deleteBackward(1);
      this.onChange(editor.value, true);
    }
    const { value } = this.state;

    // Handle two way binging between local state and outside prop.
    // if query changed from the outside
    if (query !== prevProps.query) {
      // and we have a version that differs
      if (query !== Plain.serialize(value)) {
        this.setState({ value: makeValue(query || '', syntax) });
      }
    }
  }

  /**
   * Update local state, propagate change upstream and optionally run the query afterwards.
   */
  onChange = (value: Value, runQuery?: boolean) => {
    const documentChanged = value.document !== this.state.value.document;
    const prevValue = this.state.value;
    if (this.props.onRichValueChange) {
      this.props.onRichValueChange(value);
    }

    // Update local state with new value and optionally change value upstream.
    this.setState({ value }, () => {
      // The diff is needed because the actual value of editor have much more metadata (for example text selection)
      // that is not passed upstream so every change of editor value does not mean change of the query text.
      if (documentChanged) {
        const textChanged = Plain.serialize(prevValue) !== Plain.serialize(value);
        if (textChanged && runQuery) {
          this.runOnChangeAndRunQuery();
        }
        if (textChanged && !runQuery) {
          // Debounce change propagation by default for perf reasons.
          this.runOnChangeDebounced();
        }
      }
    });
  };

  runOnChange = () => {
    const { onChange } = this.props;
    const value = Plain.serialize(this.state.value);
    if (onChange) {
      onChange(this.cleanText(value));
    }
  };

  runOnRunQuery = () => {
    const { onRunQuery } = this.props;

    if (onRunQuery) {
      onRunQuery();
      this.lastExecutedValue = this.state.value;
    }
  };

  runOnChangeAndRunQuery = () => {
    // onRunQuery executes query from Redux in Explore so it needs to be updated sync in case we want to run
    // the query.
    this.runOnChange();
    this.runOnRunQuery();
  };

  /**
   * We need to handle blur events here mainly because of dashboard panels which expect to have query executed on blur.
   */
  handleBlur = (_: React.FocusEvent | undefined, editor: Editor, next: Function) => {
    const { onBlur } = this.props;

    if (onBlur) {
      onBlur();
    } else {
      // Run query by default on blur
      const previousValue = this.lastExecutedValue ? Plain.serialize(this.lastExecutedValue) : '';
      const currentValue = Plain.serialize(editor.value);

      if (previousValue !== currentValue) {
        this.runOnChangeAndRunQuery();
      }
    }
    return next();
  };

  cleanText(text: string) {
    // RegExp with invisible characters we want to remove - currently only carriage return (newlines are visible)
    const newText = text.replace(/[\r]/g, '');
    return newText;
  }

  render() {
    const { disabled, theme } = this.props;
    const wrapperClassName = classnames('slate-query-field__wrapper', {
      'slate-query-field__wrapper--disabled': disabled,
    });
    const styles = getStyles(theme);

    return (
      <div className={cx(wrapperClassName, styles.wrapper)}>
        <div className="slate-query-field" aria-label={selectors.components.QueryField.container}>
          <Editor
            ref={(editor) => (this.editor = editor!)}
            schema={SCHEMA}
            autoCorrect={false}
            readOnly={this.props.disabled}
            onBlur={this.handleBlur}
            onClick={this.props.onClick}
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

export const QueryField = withTheme2(UnThemedQueryField);

const getStyles = (theme: GrafanaTheme2) => {
  const focusStyles = getFocusStyles(theme);
  return {
    wrapper: css`
      &:focus-within {
        ${focusStyles}
      }
    `,
  };
};
