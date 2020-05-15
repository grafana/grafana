// Libraries
import React, { ReactNode } from 'react';

import {
  ButtonCascader,
  CascaderOption,
  SlatePrism,
  TypeaheadOutput,
  SuggestionsState,
  QueryField,
  TypeaheadInput,
  BracesPlugin,
} from '@grafana/ui';

// Utils & Services
// dom also includes Element polyfills
import { Plugin, Node } from 'slate';

// Types
import { DOMUtil } from '@grafana/ui';
import { ExploreQueryFieldProps, AbsoluteTimeRange } from '@grafana/data';
import { LokiQuery, LokiOptions } from '../types';
import { Grammar } from 'prismjs';
import LokiLanguageProvider, { LokiHistoryItem } from '../language_provider';
import LokiDatasource from '../datasource';

function getChooserText(hasSyntax: boolean, hasLogLabels: boolean) {
  if (!hasSyntax) {
    return 'Loading labels...';
  }
  if (!hasLogLabels) {
    return '(No labels found)';
  }
  return 'Log labels';
}

function willApplySuggestion(suggestion: string, { typeaheadContext, typeaheadText }: SuggestionsState): string {
  // Modify suggestion based on context
  switch (typeaheadContext) {
    case 'context-labels': {
      const nextChar = DOMUtil.getNextCharacter();
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
      if (DOMUtil.getNextCharacter() !== '"') {
        suggestion = `${suggestion}"`;
      }
      break;
    }

    default:
  }
  return suggestion;
}

export interface LokiQueryFieldFormProps extends ExploreQueryFieldProps<LokiDatasource, LokiQuery, LokiOptions> {
  history: LokiHistoryItem[];
  syntax: Grammar;
  logLabelOptions: CascaderOption[];
  syntaxLoaded: boolean;
  absoluteRange: AbsoluteTimeRange;
  onLoadOptions: (selectedOptions: CascaderOption[]) => void;
  onLabelsRefresh?: () => void;
  ExtraFieldElement?: ReactNode;
}

export class LokiQueryFieldForm extends React.PureComponent<LokiQueryFieldFormProps> {
  plugins: Plugin[];

  constructor(props: LokiQueryFieldFormProps, context: React.Context<any>) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      SlatePrism({
        onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
        getSyntax: (node: Node) => 'promql',
      }),
    ];
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
    const { query, onChange, onRunQuery } = this.props;
    if (onChange) {
      const nextQuery = { ...query, expr: value };
      onChange(nextQuery);

      if (override && onRunQuery) {
        onRunQuery();
      }
    }
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource } = this.props;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const lokiLanguageProvider = datasource.languageProvider as LokiLanguageProvider;
    const { history, absoluteRange } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey } = typeahead;

    const result = await lokiLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history, absoluteRange }
    );

    //console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);

    return result;
  };

  render() {
    const {
      ExtraFieldElement,
      query,
      syntaxLoaded,
      logLabelOptions,
      onLoadOptions,
      onLabelsRefresh,
      datasource,
    } = this.props;
    const lokiLanguageProvider = datasource.languageProvider as LokiLanguageProvider;
    const cleanText = datasource.languageProvider ? lokiLanguageProvider.cleanText : undefined;
    const hasLogLabels = logLabelOptions && logLabelOptions.length > 0;
    const chooserText = getChooserText(syntaxLoaded, hasLogLabels);
    const buttonDisabled = !(syntaxLoaded && hasLogLabels);

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap flex-grow-1">
          <div className="gf-form flex-shrink-0">
            <ButtonCascader
              options={logLabelOptions || []}
              disabled={buttonDisabled}
              onChange={this.onChangeLogLabels}
              loadData={onLoadOptions}
              onPopupVisibleChange={isVisible => isVisible && onLabelsRefresh && onLabelsRefresh()}
            >
              {chooserText}
            </ButtonCascader>
          </div>
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              cleanText={cleanText}
              query={query.expr}
              onTypeahead={this.onTypeahead}
              onWillApplySuggestion={willApplySuggestion}
              onChange={this.onChangeQuery}
              onBlur={this.props.onBlur}
              onRunQuery={this.props.onRunQuery}
              placeholder="Enter a Loki query (run with Shift+Enter)"
              portalOrigin="loki"
              syntaxLoaded={syntaxLoaded}
            />
          </div>
          {ExtraFieldElement}
        </div>
      </>
    );
  }
}
