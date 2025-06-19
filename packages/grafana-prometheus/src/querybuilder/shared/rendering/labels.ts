import { config } from '@grafana/runtime';

import { prometheusRegularEscape } from '../../../escaping';
import { utf8Support } from '../../../utf8_support';
import { QueryBuilderLabelFilter } from '../types';

/**
 * Renders label filters in the format: {label1="value1", label2="value2"}
 */
export function renderLabels(labels: QueryBuilderLabelFilter[]): string {
  if (labels.length === 0) {
    return '';
  }

  let expr = '{';
  for (const filter of labels) {
    if (expr !== '{') {
      expr += ', ';
    }

    let labelValue = filter.value;
    const usingRegexOperator = filter.op === '=~' || filter.op === '!~';

    if (config.featureToggles.prometheusSpecialCharsInLabelValues && !usingRegexOperator) {
      labelValue = prometheusRegularEscape(labelValue);
    }
    expr += `${utf8Support(filter.label)}${filter.op}"${labelValue}"`;
  }

  return expr + `}`;
}

export function renderLabelsWithoutBrackets(labels: QueryBuilderLabelFilter[]): string[] {
  if (labels.length === 0) {
    return [];
  }

  const renderedLabels: string[] = [];
  for (const filter of labels) {
    let labelValue = filter.value;
    const usingRegexOperator = filter.op === '=~' || filter.op === '!~';

    if (config.featureToggles.prometheusSpecialCharsInLabelValues && !usingRegexOperator) {
      labelValue = prometheusRegularEscape(labelValue);
    }
    renderedLabels.push(`${utf8Support(filter.label)}${filter.op}"${labelValue}"`);
  }

  return renderedLabels;
}
