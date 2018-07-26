import _ from 'lodash';
import React from 'react';

// dom also includes Element polyfills
import { getNextCharacter, getPreviousCousin } from './utils/dom';
import PluginPrism, { setPrismTokens } from './slate-plugins/prism/index';
import PrismPromql, { FUNCTIONS } from './slate-plugins/prism/promql';
import RunnerPlugin from './slate-plugins/runner';
import { processLabels, RATE_RANGES, cleanText } from './utils/prometheus';

import TypeaheadField, {
  Suggestion,
  SuggestionGroup,
  TypeaheadInput,
  TypeaheadFieldState,
  TypeaheadOutput,
} from './QueryField';

const EMPTY_METRIC = '';
const METRIC_MARK = 'metric';
const PRISM_LANGUAGE = 'promql';

export const wrapLabel = label => ({ label });
export const setFunctionMove = (suggestion: Suggestion): Suggestion => {
  suggestion.move = -1;
  return suggestion;
};

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
  metric?: string;
  labelKey?: string;
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
    const { editorNode, prefix, text, wrapperNode } = typeahead;

    // Get DOM-dependent context
    const wrapperClasses = Array.from(wrapperNode.classList);
    // Take first metric as lucky guess
    const metricNode = editorNode.querySelector(`.${METRIC_MARK}`);
    const metric = metricNode && metricNode.textContent;
    const labelKeyNode = getPreviousCousin(wrapperNode, '.attr-name');
    const labelKey = labelKeyNode && labelKeyNode.textContent;

    const result = this.getTypeahead({ text, prefix, wrapperClasses, metric, labelKey });

    console.log('handleTypeahead', wrapperClasses, text, prefix, result.context);

    return result;
  };

  // Keep this DOM-free for testing
  getTypeahead({ prefix, wrapperClasses, metric, text }: PromTypeaheadInput): TypeaheadOutput {
    // Determine candidates by CSS context
    if (_.includes(wrapperClasses, 'context-range')) {
      // Suggestions for metric[|]
      return this.getRangeTypeahead();
    } else if (_.includes(wrapperClasses, 'context-labels')) {
      // Suggestions for metric{|} and metric{foo=|}, as well as metric-independent label queries like {|}
      return this.getLabelTypeahead.apply(this, arguments);
    } else if (metric && _.includes(wrapperClasses, 'context-aggregation')) {
      return this.getAggregationTypeahead.apply(this, arguments);
    } else if (
      // Non-empty but not inside known token unless it's a metric
      (prefix && !_.includes(wrapperClasses, 'token')) ||
      prefix === metric ||
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
    const suggestions: SuggestionGroup[] = [];
    suggestions.push({
      prefixMatch: true,
      label: 'Functions',
      items: FUNCTIONS.map(setFunctionMove),
    });

    if (this.state.metrics) {
      suggestions.push({
        label: 'Metrics',
        items: this.state.metrics.map(wrapLabel),
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

  getAggregationTypeahead({ metric }: PromTypeaheadInput): TypeaheadOutput {
    let refresher: Promise<any> = null;
    const suggestions: SuggestionGroup[] = [];
    const labelKeys = this.state.labelKeys[metric];
    if (labelKeys) {
      suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
    } else {
      refresher = this.fetchMetricLabels(metric);
    }

    return {
      refresher,
      suggestions,
      context: 'context-aggregation',
    };
  }

  getLabelTypeahead({ metric, text, wrapperClasses, labelKey }: PromTypeaheadInput): TypeaheadOutput {
    let context: string;
    let refresher: Promise<any> = null;
    const suggestions: SuggestionGroup[] = [];
    if (metric) {
      const labelKeys = this.state.labelKeys[metric];
      if (labelKeys) {
        if ((text && text.startsWith('=')) || _.includes(wrapperClasses, 'attr-value')) {
          // Label values
          if (labelKey) {
            const labelValues = this.state.labelValues[metric][labelKey];
            context = 'context-label-values';
            suggestions.push({
              label: 'Label values',
              items: labelValues.map(wrapLabel),
            });
          }
        } else {
          // Label keys
          context = 'context-labels';
          suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
        }
      } else {
        refresher = this.fetchMetricLabels(metric);
      }
    } else {
      // Metric-independent label queries
      const defaultKeys = ['job', 'instance'];
      // Munge all keys that we have seen together
      const labelKeys = Object.keys(this.state.labelKeys).reduce((acc, metric) => {
        return acc.concat(this.state.labelKeys[metric].filter(key => acc.indexOf(key) === -1));
      }, defaultKeys);
      if ((text && text.startsWith('=')) || _.includes(wrapperClasses, 'attr-value')) {
        // Label values
        if (labelKey) {
          if (this.state.labelValues[EMPTY_METRIC]) {
            const labelValues = this.state.labelValues[EMPTY_METRIC][labelKey];
            context = 'context-label-values';
            suggestions.push({
              label: 'Label values',
              items: labelValues.map(wrapLabel),
            });
          } else {
            // Can only query label values for now (API to query keys is under development)
            refresher = this.fetchLabelValues(labelKey);
          }
        }
      } else {
        // Label keys
        context = 'context-labels';
        suggestions.push({ label: 'Labels', items: labelKeys.map(wrapLabel) });
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
      const pairs = this.state.labelValues[EMPTY_METRIC];
      const values = {
        ...pairs,
        [key]: body.data,
      };
      const labelValues = {
        ...this.state.labelValues,
        [EMPTY_METRIC]: values,
      };
      this.setState({ labelValues });
    } catch (e) {
      console.error(e);
    }
  }

  async fetchMetricLabels(name) {
    const url = `/api/v1/series?match[]=${name}`;
    try {
      const res = await this.request(url);
      const body = await (res.data || res.json());
      const { keys, values } = processLabels(body.data);
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
