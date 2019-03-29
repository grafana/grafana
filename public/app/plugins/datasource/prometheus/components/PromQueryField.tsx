// @ts-ignore
import _ from 'lodash';
import React from 'react';
// @ts-ignore
import Cascader from 'rc-cascader';
// @ts-ignore
import PluginPrism from 'slate-prism';
// @ts-ignore
import Prism from 'prismjs';

import { TypeaheadOutput, HistoryItem } from 'app/types/explore';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from 'app/features/explore/utils/dom';
import BracesPlugin from 'app/features/explore/slate-plugins/braces';
import RunnerPlugin from 'app/features/explore/slate-plugins/runner';
import QueryField, { TypeaheadInput, QueryFieldState } from 'app/features/explore/QueryField';
import { PromQuery } from '../types';
import { CancelablePromise, makePromiseCancelable } from 'app/core/utils/CancelablePromise';
import { ExploreDataSourceApi, ExploreQueryFieldProps, DatasourceStatus } from '@grafana/ui';

const HISTOGRAM_GROUP = '__histograms__';
const METRIC_MARK = 'metric';
const PRISM_SYNTAX = 'promql';
export const RECORDING_RULES_GROUP = '__recording_rules__';

function getChooserText(hasSyntax: boolean, datasourceStatus: DatasourceStatus) {
  if (datasourceStatus === DatasourceStatus.Disconnected) {
    return '(Disconnected)';
  }
  if (!hasSyntax) {
    return 'Loading metrics...';
  }
  return 'Metrics';
}

export function groupMetricsByPrefix(metrics: string[], delimiter = '_'): CascaderOption[] {
  // Filter out recording rules and insert as first option
  const ruleRegex = /:\w+:/;
  const ruleNames = metrics.filter(metric => ruleRegex.test(metric));
  const rulesOption = {
    label: 'Recording rules',
    value: RECORDING_RULES_GROUP,
    children: ruleNames
      .slice()
      .sort()
      .map(name => ({ label: name, value: name })),
  };

  const options = ruleNames.length > 0 ? [rulesOption] : [];

  const metricsOptions = _.chain(metrics)
    .filter((metric: string) => !ruleRegex.test(metric))
    .groupBy((metric: string) => metric.split(delimiter)[0])
    .map(
      (metricsForPrefix: string[], prefix: string): CascaderOption => {
        const prefixIsMetric = metricsForPrefix.length === 1 && metricsForPrefix[0] === prefix;
        const children = prefixIsMetric ? [] : metricsForPrefix.sort().map(m => ({ label: m, value: m }));
        return {
          children,
          label: prefix,
          value: prefix,
        };
      }
    )
    .sortBy('label')
    .value();

  return [...options, ...metricsOptions];
}

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

interface PromQueryFieldProps extends ExploreQueryFieldProps<ExploreDataSourceApi, PromQuery> {
  history: HistoryItem[];
}

interface PromQueryFieldState {
  metricsOptions: any[];
  syntaxLoaded: boolean;
}

class PromQueryField extends React.PureComponent<PromQueryFieldProps, PromQueryFieldState> {
  plugins: any[];
  languageProvider: any;
  languageProviderInitializationPromise: CancelablePromise<any>;

  constructor(props: PromQueryFieldProps, context: React.Context<any>) {
    super(props, context);

    if (props.datasource.languageProvider) {
      this.languageProvider = props.datasource.languageProvider;
    }

    this.plugins = [
      BracesPlugin(),
      RunnerPlugin({ handler: props.onExecuteQuery }),
      PluginPrism({
        onlyIn: (node: any) => node.type === 'code_block',
        getSyntax: (node: any) => 'promql',
      }),
    ];

    this.state = {
      metricsOptions: [],
      syntaxLoaded: false,
    };
  }

  componentDidMount() {
    if (this.languageProvider) {
      this.refreshMetrics(makePromiseCancelable(this.languageProvider.start()));
    }
  }

  componentWillUnmount() {
    if (this.languageProviderInitializationPromise) {
      this.languageProviderInitializationPromise.cancel();
    }
  }

  componentDidUpdate(prevProps: PromQueryFieldProps) {
    const reconnected =
      prevProps.datasourceStatus === DatasourceStatus.Disconnected &&
      this.props.datasourceStatus === DatasourceStatus.Connected;
    if (!reconnected) {
      return;
    }

    if (this.languageProviderInitializationPromise) {
      this.languageProviderInitializationPromise.cancel();
    }

    if (this.languageProvider) {
      this.refreshMetrics(makePromiseCancelable(this.languageProvider.fetchMetrics()));
    }
  }

  refreshMetrics = (cancelablePromise: CancelablePromise<any>) => {
    this.languageProviderInitializationPromise = cancelablePromise;
    this.languageProviderInitializationPromise.promise
      .then(remaining => {
        remaining.map((task: Promise<any>) => task.then(this.onUpdateLanguage).catch(() => {}));
      })
      .then(() => this.onUpdateLanguage())
      .catch(({ isCanceled }) => {
        if (isCanceled) {
          console.warn('PromQueryField has unmounted, language provider intialization was canceled');
        }
      });
  };

  onChangeMetrics = (values: string[], selectedOptions: CascaderOption[]) => {
    let query;
    if (selectedOptions.length === 1) {
      if (selectedOptions[0].children.length === 0) {
        query = selectedOptions[0].value;
      } else {
        // Ignore click on group
        return;
      }
    } else {
      const prefix = selectedOptions[0].value;
      const metric = selectedOptions[1].value;
      if (prefix === HISTOGRAM_GROUP) {
        query = `histogram_quantile(0.95, sum(rate(${metric}[5m])) by (le))`;
      } else {
        query = metric;
      }
    }
    this.onChangeQuery(query, true);
  };

  onChangeQuery = (value: string, override?: boolean) => {
    // Send text change to parent
    const { query, onQueryChange, onExecuteQuery } = this.props;
    if (onQueryChange) {
      const nextQuery: PromQuery = { ...query, expr: value };
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

  onUpdateLanguage = () => {
    const { histogramMetrics, metrics } = this.languageProvider;
    if (!metrics) {
      return;
    }

    Prism.languages[PRISM_SYNTAX] = this.languageProvider.getSyntax();
    Prism.languages[PRISM_SYNTAX][METRIC_MARK] = {
      alias: 'variable',
      pattern: new RegExp(`(?:^|\\s)(${metrics.join('|')})(?:$|\\s)`),
    };

    // Build metrics tree
    const metricsByPrefix = groupMetricsByPrefix(metrics);
    const histogramOptions = histogramMetrics.map((hm: any) => ({ label: hm, value: hm }));
    const metricsOptions =
      histogramMetrics.length > 0
        ? [
            { label: 'Histograms', value: HISTOGRAM_GROUP, children: histogramOptions, isLeaf: false },
            ...metricsByPrefix,
          ]
        : metricsByPrefix;

    this.setState({ metricsOptions, syntaxLoaded: true });
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
    const { error, hint, query, datasourceStatus } = this.props;
    const { metricsOptions, syntaxLoaded } = this.state;
    const cleanText = this.languageProvider ? this.languageProvider.cleanText : undefined;
    const chooserText = getChooserText(syntaxLoaded, datasourceStatus);
    const buttonDisabled = !syntaxLoaded || datasourceStatus === DatasourceStatus.Disconnected;

    return (
      <>
        <div className="gf-form-inline gf-form-inline--nowrap">
          <div className="gf-form flex-shrink-0">
            <Cascader options={metricsOptions} onChange={this.onChangeMetrics}>
              <button className="gf-form-label gf-form-label--btn" disabled={buttonDisabled}>
                {chooserText} <i className="fa fa-caret-down" />
              </button>
            </Cascader>
          </div>
          <div className="gf-form gf-form--grow flex-shrink-1">
            <QueryField
              additionalPlugins={this.plugins}
              cleanText={cleanText}
              initialQuery={query.expr}
              onTypeahead={this.onTypeahead}
              onWillApplySuggestion={willApplySuggestion}
              onQueryChange={this.onChangeQuery}
              onExecuteQuery={this.props.onExecuteQuery}
              placeholder="Enter a PromQL query"
              portalOrigin="prometheus"
              syntaxLoaded={syntaxLoaded}
            />
          </div>
        </div>
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
      </>
    );
  }
}

export default PromQueryField;
