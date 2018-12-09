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
import QueryField, { TypeaheadInput, QueryFieldState } from 'app/features/explore/QueryField';
import { DataQuery } from 'app/types';
import { parseQuery, formatQuery } from '../query_utils';

const PRISM_SYNTAX = 'promql';

const SEARCH_FIELD_STYLES = {
  width: '66%',
  marginLeft: 3,
};

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

interface LokiQueryFieldProps {
  datasource: any;
  error?: string | JSX.Element;
  hint?: any;
  history?: any[];
  initialQuery?: DataQuery;
  onClickHintFix?: (action: any) => void;
  onPressEnter?: () => void;
  onQueryChange?: (value: DataQuery, override?: boolean) => void;
}

interface LokiQueryFieldState {
  logLabelOptions: any[];
  syntaxLoaded: boolean;
}

class LokiQueryField extends React.PureComponent<LokiQueryFieldProps, LokiQueryFieldState> {
  plugins: any[];
  pluginsSearch: any[];
  languageProvider: any;
  modifiedSearch: string;
  modifiedQuery: string;

  constructor(props: LokiQueryFieldProps, context) {
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

    this.pluginsSearch = [RunnerPlugin({ handler: props.onPressEnter })];

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
    const enableSearchField = !this.modifiedQuery && value;
    this.modifiedQuery = value;
    // Send text change to parent
    const { initialQuery, onQueryChange } = this.props;
    if (onQueryChange) {
      const search = this.modifiedSearch || parseQuery(initialQuery.expr).regexp;
      const expr = formatQuery(value, search);
      const query = {
        ...initialQuery,
        expr,
      };
      onQueryChange(query, override);
    }
    // Enable the search field if we have a selector query
    if (enableSearchField) {
      this.forceUpdate();
    }
  };

  onChangeSearch = (value: string, override?: boolean) => {
    this.modifiedSearch = value;
    // Send text change to parent
    const { initialQuery, onQueryChange } = this.props;
    if (onQueryChange) {
      const selector = this.modifiedQuery || parseQuery(initialQuery.expr).query;
      const expr = formatQuery(selector, value);
      const query = {
        ...initialQuery,
        expr,
      };
      onQueryChange(query, override);
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
    const parsedInitialQuery = parseQuery(initialQuery.expr);
    // Disable search field to make clear that we need a selector query first
    const searchDisabled = !parsedInitialQuery.query && !this.modifiedQuery;

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
          <QueryField
            additionalPlugins={this.plugins}
            cleanText={cleanText}
            initialQuery={parsedInitialQuery.query}
            onTypeahead={this.onTypeahead}
            onWillApplySuggestion={willApplySuggestion}
            onValueChanged={this.onChangeQuery}
            placeholder="Start with a Loki stream selector"
            portalOrigin="loki"
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
        <div className="prom-query-field-wrapper" style={SEARCH_FIELD_STYLES}>
          <QueryField
            additionalPlugins={this.pluginsSearch}
            disabled={searchDisabled}
            initialQuery={parsedInitialQuery.regexp}
            onValueChanged={this.onChangeSearch}
            placeholder="Search by regular expression"
            portalOrigin="loki"
          />
        </div>
      </div>
    );
  }
}

export default LokiQueryField;
