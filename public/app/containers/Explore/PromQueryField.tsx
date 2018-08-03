import _ from 'lodash';
import moment from 'moment';
import React from 'react';
import { Value } from 'slate';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from './utils/dom';
import PluginPrism, { setPrismTokens } from './slate-plugins/prism/index';
import PrismPromql, { FUNCTIONS } from './slate-plugins/prism/promql';
import RunnerPlugin from './slate-plugins/runner';
import { processLabels, RATE_RANGES, cleanText, getCleanSelector } from './utils/prometheus';

import TypeaheadField, {
  Suggestion,
  SuggestionGroup,
  TypeaheadInput,
  TypeaheadFieldState,
  TypeaheadOutput,
} from './QueryField';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
const HISTORY_ITEM_COUNT = 5;
const HISTORY_COUNT_CUTOFF = 1000 * 60 * 60 * 24; // 24h
const METRIC_MARK = 'metric';
const PRISM_LANGUAGE = 'promql';

export const wrapLabel = label => ({ label });
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

interface PromQueryFieldProps {
  history?: any[];
  initialQuery?: string | null;
  labelKeys?: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues?: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics?: string[];
  onPressEnter?: () => void;
  onQueryChange?: (value: string) => void;
  portalPrefix?: string;
  request?: (url: string) => any;
}

interface PromQueryFieldState {
  labelKeys: { [index: string]: string[] }; // metric -> [labelKey,...]
  labelValues: { [index: string]: { [index: string]: string[] } }; // metric -> labelKey -> [labelValue,...]
  metrics: string[];
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

  constructor(props, context) {
    super(props, context);

    this.plugins = [
      RunnerPlugin({ handler: props.onPressEnter }),
      PluginPrism({ definition: PrismPromql, language: PRISM_LANGUAGE }),
    ];

    this.state = {
      labelKeys: props.labelKeys || {},
      labelValues: props.labelValues || {},
      metrics: props.metrics || [],
    };
  }

  componentDidMount() {
    this.fetchMetricNames();
  }

  onChangeQuery = value => {
    // Send text change to parent
    const { onQueryChange } = this.props;
    if (onQueryChange) {
      onQueryChange(value);
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
    const selector = getCleanSelector(selectorString, selectorString.length - 2);

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
    try {
      selector = getCleanSelector(line, cursorOffset);
    } catch {
      selector = EMPTY_SELECTOR;
    }
    const containsMetric = selector.indexOf('__name__=') > -1;

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
        context = 'context-labels';
        suggestions.push({ label: `Labels`, items: labelKeys.map(wrapLabel) });
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

  async fetchLabelValues(key) {
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

  async fetchSeriesLabels(name, withName?) {
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
      this.setState({ labelKeys, labelValues });
    } catch (e) {
      console.error(e);
    }
  }

  async fetchMetricNames() {
    const url = '/api/v1/label/__name__/values';
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      this.setState({ metrics: body.data }, this.onReceiveMetrics);
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    return (
      <TypeaheadField
        additionalPlugins={this.plugins}
        cleanText={cleanText}
        initialValue={this.props.initialQuery}
        onTypeahead={this.onTypeahead}
        onWillApplySuggestion={willApplySuggestion}
        onValueChanged={this.onChangeQuery}
        placeholder="Enter a PromQL query"
      />
    );
  }
}

export default PromQueryField;
