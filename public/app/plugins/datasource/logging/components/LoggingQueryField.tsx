import _ from 'lodash';
import React from 'react';
import Cascader from 'rc-cascader';
import PluginPrism from 'slate-prism';
import Prism from 'prismjs';

import { TypeaheadOutput } from 'app/types/explore';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from 'app/features/explore/utils/dom';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';
import TypeaheadField, { TypeaheadInput, QueryFieldState } from 'app/features/explore/QueryField';

const PRISM_SYNTAX = 'promql';

export function willApplySuggestion(suggestion: string, { typeaheadContext, typeaheadText }: QueryFieldState): string {
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
      if (!typeaheadText.match(/^(!?=~?"|")/)) {
        suggestion = `"${suggestion}`;
      }
      if (getNextCharacter() !== '"') {
        suggestion = `${suggestion}"`;
      }
      break;
    }

    default:
  }
  return suggestion;
}

interface CascaderOption {
  label: string;
  value: string;
  children?: CascaderOption[];
  disabled?: boolean;
}

interface LoggingQueryFieldProps {
  datasource: any;
  error?: string | JSX.Element;
  hint?: any;
  history?: any[];
  initialQuery?: string | null;
  onClickHintFix?: (action: any) => void;
  onPressEnter?: () => void;
  onQueryChange?: (value: string, override?: boolean) => void;
}

interface LoggingQueryFieldState {
  logLabelOptions: any[];
  syntaxLoaded: boolean;
}

class LoggingQueryField extends React.PureComponent<LoggingQueryFieldProps, LoggingQueryFieldState> {
  plugins: any[];
  languageProvider: any;

  constructor(props: LoggingQueryFieldProps, context) {
    super(props, context);

    if (props.datasource.languageProvider) {
      this.languageProvider = props.datasource.languageProvider;
    }

    this.plugins = [
      BracesPlugin(),
      RunnerPlugin({ handler: props.onPressEnter }),
      PluginPrism({
        onlyIn: node => node.type === 'code_block',
        getSyntax: node => 'promql',
      }),
    ];

    this.state = {
      logLabelOptions: [],
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    if (this.languageProvider) {
      this.languageProvider
        .start()
        .then(remaining => {
          remaining.map(task => task.then(this.onUpdateLanguage).catch(() => {}));
        })
        .then(() => this.onUpdateLanguage());
    }
  }

  loadOptions = (selectedOptions: CascaderOption[]) => {
    const targetOption = selectedOptions[selectedOptions.length - 1];

    this.setState(state => {
      const nextOptions = state.logLabelOptions.map(option => {
        if (option.value === targetOption.value) {
          return {
            ...option,
            loading: true,
          };
        }
        return option;
      });
      return { logLabelOptions: nextOptions };
    });

    this.languageProvider
      .fetchLabelValues(targetOption.value)
      .then(this.onUpdateLanguage)
      .catch(() => {});
  };

  onChangeLogLabels = (values: string[], selectedOptions: CascaderOption[]) => {
    if (selectedOptions.length === 2) {
      const key = selectedOptions[0].value;
      const value = selectedOptions[1].value;
      const query = `{${key}="${value}"}`;
      this.onChangeQuery(query, true);
    }
  };

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { onQueryChange } = this.props;
    if (onQueryChange) {
      onQueryChange(value, override);
    }
  };

  onClickHintFix = () => {
    const { hint, onClickHintFix } = this.props;
    if (onClickHintFix && hint && hint.fix) {
      onClickHintFix(hint.fix.action);
    }
  };

  onUpdateLanguage = () => {
    Prism.languages[PRISM_SYNTAX] = this.languageProvider.getSyntax();
    const { logLabelOptions } = this.languageProvider;
    this.setState({
      logLabelOptions,
      syntaxLoaded: true,
    });
  };

  onTypeahead = (typeahead: TypeaheadInput): TypeaheadOutput => {
    if (!this.languageProvider) {
      return { suggestions: [] };
    }

    const { history } = this.props;
    const { prefix, text, value, wrapperNode } = typeahead;

    // Get DOM-dependent context
    const wrapperClasses = Array.from(wrapperNode.classList);
    const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
    const labelKey = labelKeyNode && labelKeyNode.textContent;
    const nextChar = getNextCharacter();

    const result = this.languageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history }
    );

    console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);

    return result;
  };

  render() {
    const { error, hint, initialQuery } = this.props;
    const { logLabelOptions, syntaxLoaded } = this.state;
    const cleanText = this.languageProvider ? this.languageProvider.cleanText : undefined;
    const chooserText = syntaxLoaded ? 'Log labels' : 'Loading labels...';

    return (
      <div className="prom-query-field">
        <div className="prom-query-field-tools">
          <Cascader options={logLabelOptions} onChange={this.onChangeLogLabels} loadData={this.loadOptions}>
            <button className="btn navbar-button navbar-button--tight" disabled={!syntaxLoaded}>
              {chooserText}
            </button>
          </Cascader>
        </div>
        <div className="prom-query-field-wrapper">
          <TypeaheadField
            additionalPlugins={this.plugins}
            cleanText={cleanText}
            initialValue={initialQuery}
            onTypeahead={this.onTypeahead}
            onWillApplySuggestion={willApplySuggestion}
            onValueChanged={this.onChangeQuery}
            placeholder="Enter a PromQL query"
            portalOrigin="prometheus"
            syntaxLoaded={syntaxLoaded}
          />
          {error ? <div className="prom-query-field-info text-error">{error}</div> : null}
          {hint ? (
            <div className="prom-query-field-info text-warning">
              {hint.label}{' '}
              {hint.fix ? (
                <a className="text-link muted" onClick={this.onClickHintFix}>
                  {hint.fix.label}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}

export default LoggingQueryField;
