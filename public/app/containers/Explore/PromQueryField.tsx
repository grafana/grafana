import _ from 'lodash';
import moment from 'moment';
import React from 'react';
import { Value } from 'slate';
import Cascader from 'rc-cascader';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from './utils/dom';
import PluginPrism, { setPrismTokens } from './slate-plugins/prism/index';
import PrismPromql, { FUNCTIONS } from './slate-plugins/prism/promql';
import BracesPlugin from './slate-plugins/braces';
import RunnerPlugin from './slate-plugins/runner';
import { processLabels, RATE_RANGES, cleanText, parseSelector } from './utils/prometheus';

import TypeaheadField, {
  Suggestion,
  SuggestionGroup,
  TypeaheadInput,
  TypeaheadFieldState,
  TypeaheadOutput,
} from './QueryField';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTOGRAM_GROUP = '__histograms__';
const HISTOGRAM_SELECTOR = '{le!=""}'; // Returns all timeseries for histograms
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const METRIC_MARK = 'metric';
const PRISM_LANGUAGE = 'promql';
export const RECORDING_RULES_GROUP = '__recording_rules__';

export const wrapLabel = (label: string) => ({ label });
export const setFunctionMove = (suggestion: Suggestion): Suggestion => {
  suggestion.move = -1;
  return suggestion;
};

export function addHistoryMetadata(item: Suggestion, history: any[]): Suggestion {
  const cutoffTs = Date.now() - HISTORY_COUNT_CUTOFF;
  const historyForItem = history.filter(h => h.ts > cutoffTs && h.query === item.label);
  const count = historyForItem.length;
  const recent = historyForItem[0];
  let hint = `Queried ${count} times in the last 24h.`;
  if (recent) {
    const lastQueried = moment(recent.ts).fromNow();
    hint = `${hint} Last queried ${lastQueried}.`;
  }
  return {
    ...item,
    documentation: hint,
  };
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

export function willApplySuggestion(
  suggestion: string,
  { typeaheadContext, typeaheadText }: TypeaheadFieldState
): string {
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
  return suggestion;
}

interface CascaderOption {
  label: string;
  value: string;
  children?: CascaderOption[];
  disabled?: boolean;
}

interface PromQueryFieldProps {
  error?: string;
  hint?: any;
  histogramMetrics?: string[];
  history?: any[];
  initialQuery?: string | null;
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics?: string[];
  metricsByPrefix?: CascaderOption[];
  onClickHintFix?: (action: any) => void;
  onPressEnter?: () => void;
  onQueryChange?: (value: string, override?: boolean) => void;
  portalPrefix?: string;
  request?: (url: string) => any;
}

interface PromQueryFieldState {
  histogramMetrics: string[];
  labelKeys: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics: string[];
  metricsByPrefix: CascaderOption[];
}

interface PromTypeaheadInput {
  text: string;
  prefix: string;
  wrapperClasses: string[];
  labelKey?: string;
  value?: Value;
}

class PromQueryField extends React.Component<PromQueryFieldProps, PromQueryFieldState> {
  plugins: any[];

  constructor(props: PromQueryFieldProps, context) {
    super(props, context);

    this.plugins = [
      BracesPlugin(),
      RunnerPlugin({ handler: props.onPressEnter }),
      PluginPrism({ definition: PrismPromql, language: PRISM_LANGUAGE }),
    ];

    this.state = {
      histogramMetrics: props.histogramMetrics || [],
      labelKeys: props.labelKeys || {},
      labelValues: props.labelValues || {},
      metrics: props.metrics || [],
      metricsByPrefix: props.metricsByPrefix || [],
    };
  }

  componentDidMount() {
    this.fetchMetricNames();
    this.fetchHistogramMetrics();
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

  onReceiveMetrics = () => {
    if (!this.state.metrics) {
      return;
    }
    setPrismTokens(PRISM_LANGUAGE, METRIC_MARK, this.state.metrics);
  };

  onTypeahead = (typeahead: TypeaheadInput): TypeaheadOutput => {
    const { prefix, text, value, wrapperNode } = typeahead;

    // Get DOM-dependent context
    const wrapperClasses = Array.from(wrapperNode.classList);
    const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
    const labelKey = labelKeyNode && labelKeyNode.textContent;
    const nextChar = getNextCharacter();

    const result = this.getTypeahead({ text, value, prefix, wrapperClasses, labelKey });

    console.log('handleTypeahead', wrapperClasses, text, prefix, nextChar, labelKey, result.context);

    return result;
  };

  // Keep this DOM-free for testing
  getTypeahead({ prefix, wrapperClasses, text }: PromTypeaheadInput): TypeaheadOutput {
    // Determine candidates by CSS context
    if (_.includes(wrapperClasses, 'context-range')) {
      // Suggestions for metric[|]
      return this.getRangeTypeahead();
    } else if (_.includes(wrapperClasses, 'context-labels')) {
      // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
      return this.getLabelTypeahead.apply(this, arguments);
    } else if (_.includes(wrapperClasses, 'context-aggregation')) {
      return this.getAggregationTypeahead.apply(this, arguments);
    } else if (
      // Non-empty but not inside known token
      (prefix && !_.includes(wrapperClasses, 'token')) ||
      (prefix === '' && !text.match(/^[)\s]+$/)) || // Empty context or after ')'
      text.match(/[+\-*/^%]/) // After binary operator
    ) {
      return this.getEmptyTypeahead();
    }

    return {
      suggestions: [],
    };
  }

  getEmptyTypeahead(): TypeaheadOutput {
    const { history } = this.props;
    const { metrics } = this.state;
    const suggestions: SuggestionGroup[] = [];

    if (history && history.length > 0) {
      const historyItems = _.chain(history)
        .uniqBy('query')
        .take(HISTORY_ITEM_COUNT)
        .map(h => h.query)
        .map(wrapLabel)
        .map(item => addHistoryMetadata(item, history))
        .value();

      suggestions.push({
        prefixMatch: true,
        skipSort: true,
        label: 'History',
        items: historyItems,
      });
    }

    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionMove),
    });

    if (metrics) {
      suggestions.push({
        label: 'Metrics',
        items: metrics.map(wrapLabel),
      });
    }
    return { suggestions };
  }

  getRangeTypeahead(): TypeaheadOutput {
    return {
      context: 'context-range',
      suggestions: [
        {
          label: 'Range vector',
          items: [...RATE_RANGES].map(wrapLabel),
        },
      ],
    };
  }

  getAggregationTypeahead({ value }: PromTypeaheadInput): TypeaheadOutput {
    let refresher: Promise<any> = null;
    const suggestions: SuggestionGroup[] = [];

    // sum(foo{bar="1"}) by (|)
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.anchorOffset;
    // sum(foo{bar="1"}) by (
    const leftSide = line.slice(0, cursorOffset);
    const openParensAggregationIndex = leftSide.lastIndexOf('(');
    const openParensSelectorIndex = leftSide.slice(0, openParensAggregationIndex).lastIndexOf('(');
    const closeParensSelectorIndex = leftSide.slice(openParensSelectorIndex).indexOf(')') + openParensSelectorIndex;
    // foo{bar="1"}
    const selectorString = leftSide.slice(openParensSelectorIndex + 1, closeParensSelectorIndex);
    const selector = parseSelector(selectorString, selectorString.length - 2).selector;

    const labelKeys = this.state.labelKeys[selector];
    if (labelKeys) {
      suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
    } else {
      refresher = this.fetchSeriesLabels(selector);
    }

    return {
      refresher,
      suggestions,
      context: 'context-aggregation',
    };
  }

  getLabelTypeahead({ text, wrapperClasses, labelKey, value }: PromTypeaheadInput): TypeaheadOutput {
    let context: string;
    let refresher: Promise<any> = null;
    const suggestions: SuggestionGroup[] = [];
    const line = value.anchorBlock.getText();
    const cursorOffset: number = value.anchorOffset;

    // Get normalized selector
    let selector;
    let parsedSelector;
    try {
      parsedSelector = parseSelector(line, cursorOffset);
      selector = parsedSelector.selector;
    } catch {
      selector = EMPTY_SELECTOR;
    }
    const containsMetric = selector.indexOf('__name__=') > -1;
    const existingKeys = parsedSelector ? parsedSelector.labelKeys : [];

    if ((text && text.startsWith('=')) || _.includes(wrapperClasses, 'attr-value')) {
      // Label values
      if (labelKey && this.state.labelValues[selector] && this.state.labelValues[selector][labelKey]) {
        const labelValues = this.state.labelValues[selector][labelKey];
        context = 'context-label-values';
        suggestions.push({
          label: `Label values for "${labelKey}"`,
          items: labelValues.map(wrapLabel),
        });
      }
    } else {
      // Label keys
      const labelKeys = this.state.labelKeys[selector] || (containsMetric ? null : DEFAULT_KEYS);
      if (labelKeys) {
        const possibleKeys = _.difference(labelKeys, existingKeys);
        if (possibleKeys.length > 0) {
          context = 'context-labels';
          suggestions.push({ label: `Labels`, items: possibleKeys.map(wrapLabel) });
        }
      }
    }

    // Query labels for selector
    if (selector && !this.state.labelValues[selector]) {
      if (selector === EMPTY_SELECTOR) {
        // Query label values for default labels
        refresher = Promise.all(DEFAULT_KEYS.map(key => this.fetchLabelValues(key)));
      } else {
        refresher = this.fetchSeriesLabels(selector, !containsMetric);
      }
    }

    return { context, refresher, suggestions };
  }

  request = url => {
    if (this.props.request) {
      return this.props.request(url);
    }
    return fetch(url);
  };

  fetchHistogramMetrics() {
    this.fetchSeriesLabels(HISTOGRAM_SELECTOR, true, () => {
      const histogramSeries = this.state.labelValues[HISTOGRAM_SELECTOR];
      if (histogramSeries && histogramSeries['__name__']) {
        const histogramMetrics = histogramSeries['__name__'].slice().sort();
        this.setState({ histogramMetrics });
      }
    });
  }

  async fetchLabelValues(key: string) {
    const url = `/api/v1/label/${key}/values`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const exisingValues = this.state.labelValues[EMPTY_SELECTOR];
      const values = {
        ...exisingValues,
        [key]: body.data,
      };
      const labelValues = {
        ...this.state.labelValues,
        [EMPTY_SELECTOR]: values,
      };
      this.setState({ labelValues });
    } catch (e) {
      console.error(e);
    }
  }

  async fetchSeriesLabels(name: string, withName?: boolean, callback?: () => void) {
    const url = `/api/v1/series?match[]=${name}`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const { keys, values } = processLabels(body.data, withName);
      const labelKeys = {
        ...this.state.labelKeys,
        [name]: keys,
      };
      const labelValues = {
        ...this.state.labelValues,
        [name]: values,
      };
      this.setState({ labelKeys, labelValues }, callback);
    } catch (e) {
      console.error(e);
    }
  }

  async fetchMetricNames() {
    const url = '/api/v1/label/__name__/values';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const metrics = body.data;
      const metricsByPrefix = groupMetricsByPrefix(metrics);
      this.setState({ metrics, metricsByPrefix }, this.onReceiveMetrics);
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    const { error, hint } = this.props;
    const { histogramMetrics, metricsByPrefix } = this.state;
    const histogramOptions = histogramMetrics.map(hm => ({ label: hm, value: hm }));
    const metricsOptions = [
      { label: 'Histograms', value: HISTOGRAM_GROUP, children: histogramOptions },
      ...metricsByPrefix,
    ];

    return (
      <div className="prom-query-field">
        <div className="prom-query-field-tools">
          <Cascader options={metricsOptions} onChange={this.onChangeMetrics}>
            <button className="btn navbar-button navbar-button--tight">Metrics</button>
          </Cascader>
        </div>
        <div className="prom-query-field-wrapper">
          <div className="slate-query-field-wrapper">
            <TypeaheadField
              additionalPlugins={this.plugins}
              cleanText={cleanText}
              initialValue={this.props.initialQuery}
              onTypeahead={this.onTypeahead}
              onWillApplySuggestion={willApplySuggestion}
              onValueChanged={this.onChangeQuery}
              placeholder="Enter a PromQL query"
            />
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
        </div>
      </div>
    );
  }
}

export default PromQueryField;
