import React, { ReactNode } from 'react';
import {
  SlatePrism,
  TypeaheadOutput,
  SuggestionsState,
  QueryField,
  TypeaheadInput,
  BracesPlugin,
  DOMUtil,
  Icon,
} from '@grafana/ui';
import { Plugin, Node } from 'slate';
import { LokiLabelBrowser } from './LokiLabelBrowser';
import { ExploreQueryFieldProps } from '@grafana/data';
import { LokiQuery, LokiOptions } from '../types';
import { LanguageMap, languages as prismLanguages } from 'prismjs';
import LokiLanguageProvider, { LokiHistoryItem } from '../language_provider';
import { shouldRefreshLabels } from '../language_utils';
import LokiDatasource from '../datasource';

function getChooserText(hasSyntax: boolean, hasLogLabels: boolean) {
  if (!hasSyntax) {
    return 'Loading labels...';
  }
  if (!hasLogLabels) {
    return '(No logs found)';
  }
  return 'Log browser';
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

export interface LokiQueryFieldProps extends ExploreQueryFieldProps<LokiDatasource, LokiQuery, LokiOptions> {
  history: LokiHistoryItem[];
  ExtraFieldElement?: ReactNode;
  placeholder?: string;
  'data-testid'?: string;
}

interface LokiQueryFieldState {
  labelsLoaded: boolean;
  labelBrowserVisible: boolean;
}

export class LokiQueryField extends React.PureComponent<LokiQueryFieldProps, LokiQueryFieldState> {
  plugins: Plugin[];

  constructor(props: LokiQueryFieldProps) {
    super(props);

    this.state = { labelsLoaded: false, labelBrowserVisible: false };

    this.plugins = [
      BracesPlugin(),
      SlatePrism(
        {
          onlyIn: (node: Node) => node.object === 'block' && node.type === 'code_block',
          getSyntax: (node: Node) => 'logql',
        },
        { ...(prismLanguages as LanguageMap), logql: this.props.datasource.languageProvider.getSyntax() }
      ),
    ];
  }

  async componentDidMount() {
    await this.props.datasource.languageProvider.start();
    this.setState({ labelsLoaded: true });
  }

  componentDidUpdate(prevProps: LokiQueryFieldProps) {
    const {
      range,
      datasource: { languageProvider },
    } = this.props;
    const refreshLabels = shouldRefreshLabels(range, prevProps.range);
    // We want to refresh labels when range changes (we round up intervals to a minute)
    if (refreshLabels) {
      languageProvider.fetchLabels();
    }
  }

  onChangeLabelBrowser = (selector: string) => {
    this.onChangeQuery(selector, true);
    this.setState({ labelBrowserVisible: false });
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

  onClickChooserButton = () => {
    this.setState((state) => ({ labelBrowserVisible: !state.labelBrowserVisible }));
  };

  onTypeahead = async (typeahead: TypeaheadInput): Promise<TypeaheadOutput> => {
    const { datasource } = this.props;

    if (!datasource.languageProvider) {
      return { suggestions: [] };
    }

    const lokiLanguageProvider = datasource.languageProvider as LokiLanguageProvider;
    const { history } = this.props;
    const { prefix, text, value, wrapperClasses, labelKey } = typeahead;

    const result = await lokiLanguageProvider.provideCompletionItems(
      { text, value, prefix, wrapperClasses, labelKey },
      { history }
    );
    return result;
  };

  render() {
    const {
      ExtraFieldElement,
      query,
      datasource,
      placeholder = 'Enter a Loki query (run with Shift+Enter)',
    } = this.props;

    const { labelsLoaded, labelBrowserVisible } = this.state;
    const lokiLanguageProvider = datasource.languageProvider as LokiLanguageProvider;
    const cleanText = datasource.languageProvider ? lokiLanguageProvider.cleanText : undefined;
    const hasLogLabels = lokiLanguageProvider.getLabelKeys().length > 0;
    const chooserText = getChooserText(labelsLoaded, hasLogLabels);
    const buttonDisabled = !(labelsLoaded && hasLogLabels);

    return (
      <>
        <div
          className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
          data-testid={this.props['data-testid']}
        >
          <button
            className="gf-form-label query-keyword pointer"
            onClick={this.onClickChooserButton}
            disabled={buttonDisabled}
          >
            {chooserText}
            <Icon name={labelBrowserVisible ? 'angle-down' : 'angle-right'} />
          </button>
          <div className="gf-form gf-form--grow flex-shrink-1 min-width-15">
            <QueryField
              additionalPlugins={this.plugins}
              cleanText={cleanText}
              query={query.expr}
              onTypeahead={this.onTypeahead}
              onWillApplySuggestion={willApplySuggestion}
              onChange={this.onChangeQuery}
              onBlur={this.props.onBlur}
              onRunQuery={this.props.onRunQuery}
              placeholder={placeholder}
              portalOrigin="loki"
            />
          </div>
        </div>
        {labelBrowserVisible && (
          <div className="gf-form">
            <LokiLabelBrowser languageProvider={lokiLanguageProvider} onChange={this.onChangeLabelBrowser} />
          </div>
        )}

        {ExtraFieldElement}
      </>
    );
  }
}
