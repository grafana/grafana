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

const HISTOGRAM_GROUP = '__histograms__';
const METRIC_MARK = 'metric';
const PRISM_SYNTAX = 'promql';
export const RECORDING_RULES_GROUP = '__recording_rules__';

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
    .filter(metric => !ruleRegex.test(metric))
    .groupBy(metric => metric.split(delimiter)[0])
    .map((metricsForPrefix: string[], prefix: string): CascaderOption => {
      const prefixIsMetric = metricsForPrefix.length === 1 && metricsForPrefix[0] === prefix;
      const children = prefixIsMetric ? [] : metricsForPrefix.sort().map(m => ({ label: m, value: m }));
      return {
        children,
        label: prefix,
        value: prefix,
      };
    })
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

interface PromQueryFieldProps {
  datasource: any;
  error?: string | JSX.Element;
  hint?: any;
  history?: any[];
  initialQuery?: string | null;
  metricsByPrefix?: CascaderOption[];
  onClickHintFix?: (action: any) => void;
  onPressEnter?: () => void;
  onQueryChange?: (value: string, override?: boolean) => void;
}

interface PromQueryFieldState {
  metricsOptions: any[];
  metricsByPrefix: CascaderOption[];
  syntaxLoaded: boolean;
}

class PromQueryField extends React.PureComponent<PromQueryFieldProps, PromQueryFieldState> {
  plugins: any[];
  languageProvider: any;

  constructor(props: PromQueryFieldProps, context) {
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
      metricsByPrefix: [],
      metricsOptions: [],
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
    const histogramOptions = histogramMetrics.map(hm => ({ label: hm, value: hm }));
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
    const { error, hint, initialQuery } = this.props;
    const { metricsOptions, syntaxLoaded } = this.state;
    const cleanText = this.languageProvider ? this.languageProvider.cleanText : undefined;
    const chooserText = syntaxLoaded ? 'Metrics' : 'Loading matrics...';

    return (
      <div className="prom-query-field">
        <div className="prom-query-field-tools">
          <Cascader options={metricsOptions} onChange={this.onChangeMetrics}>
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

export default PromQueryField;
