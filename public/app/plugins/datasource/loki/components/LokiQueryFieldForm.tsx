// Libraries
import React from 'react';
import Cascader from 'rc-cascader';
import PluginPrism from 'slate-prism';

// Components
import QueryField, { TypeaheadInput, QueryFieldState } from 'app/features/explore/QueryField';

// Utils & Services
// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from 'app/features/explore/utils/dom';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';

// Types
import { LokiQuery } from '../types';
import { TypeaheadOutput, HistoryItem } from 'app/types/explore';
import { ExploreDataSourceApi, ExploreQueryFieldProps } from '@grafana/ui';

function getChooserText(hasSytax, hasLogLabels) {
  if (!hasSytax) {
    return 'Loading labels...';
  }
  if (!hasLogLabels) {
    return '(No labels found)';
  }
  return 'Log labels';
}

function willApplySuggestion(suggestion: string, { typeaheadContext, typeaheadText }: QueryFieldState): string {
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

export interface CascaderOption {
  label: string;
  value: string;
  children?: CascaderOption[];
  disabled?: boolean;
}

export interface LokiQueryFieldFormProps extends ExploreQueryFieldProps<ExploreDataSourceApi, LokiQuery> {
  history: HistoryItem[];
  syntax: any;
  logLabelOptions: any[];
  syntaxLoaded: any;
  onLoadOptions: (selectedOptions: CascaderOption[]) => void;
  onLabelsRefresh?: () => void;
}

export class LokiQueryFieldForm extends React.PureComponent<LokiQueryFieldFormProps> {
  plugins: any[];
  pluginsSearch: any[];
  modifiedSearch: string;
  modifiedQuery: string;

  constructor(props: LokiQueryFieldFormProps, context) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      RunnerPlugin({ handler: props.onExecuteQuery }),
      PluginPrism({
        onlyIn: node => node.type === 'code_block',
        getSyntax: node => 'promql',
      }),
    ];

    this.pluginsSearch = [RunnerPlugin({ handler: props.onExecuteQuery })];
  }

  loadOptions = (selectedOptions: CascaderOption[]) => {
    this.props.onLoadOptions(selectedOptions);
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
    const { query, onQueryChange, onExecuteQuery } = this.props;
    if (onQueryChange) {
      const nextQuery = { ...query, expr: value };
      onQueryChange(nextQuery);

      if (override && onExecuteQuery) {
        onExecuteQuery();
      }
    }
  };

  onClickHintFix = () => {
    const { hint, onExecuteHint } = this.props;
    if (onExecuteHint && hint && hint.fix) {
      onExecuteHint(hint.fix.action);
    }
  };

  onTypeahead = (typeahead: TypeaheadInput): TypeaheadOutput => {
    const { datasource } = this.props;
    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const { history } = this.props;
    const { prefix, text, value, wrapperNode } = typeahead;

    // Get DOM-dependent context
    const wrapperClasses = Array.from(wrapperNode.classList);
    const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
    const labelKey = labelKeyNode && labelKeyNode.textContent;
    const nextChar = getNextCharacter();

    const result = datasource.languageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history }
    );

    console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);

    return result;
  };

  render() {
    const {
      error,
      hint,
      query,
      syntaxLoaded,
      logLabelOptions,
      onLoadOptions,
      onLabelsRefresh,
      datasource,
    } = this.props;
    const cleanText = datasource.languageProvider ? datasource.languageProvider.cleanText : undefined;
    const hasLogLabels = logLabelOptions && logLabelOptions.length > 0;
    const chooserText = getChooserText(syntaxLoaded, hasLogLabels);

    return (
      <>
        <div className="gf-form-inline">
          <div className="gf-form">
            <Cascader
              options={logLabelOptions}
              onChange={this.onChangeLogLabels}
              loadData={onLoadOptions}
              onPopupVisibleChange={isVisible => {
                if (isVisible && onLabelsRefresh) {
                  onLabelsRefresh();
                }
              }}
            >
              <button className="gf-form-label gf-form-label--btn" disabled={!syntaxLoaded}>
                {chooserText} <i className="fa fa-caret-down" />
              </button>
            </Cascader>
          </div>
          <div className="gf-form gf-form--grow">
            <QueryField
              additionalPlugins={this.plugins}
              cleanText={cleanText}
              initialQuery={query.expr}
              onTypeahead={this.onTypeahead}
              onWillApplySuggestion={willApplySuggestion}
              onQueryChange={this.onChangeQuery}
              onExecuteQuery={this.props.onExecuteQuery}
              placeholder="Enter a Loki query"
              portalOrigin="loki"
              syntaxLoaded={syntaxLoaded}
            />
          </div>
        </div>
        <div>
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
      </>
    );
  }
}
