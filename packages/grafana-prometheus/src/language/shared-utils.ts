// Move shared functionality here from language_utils.ts
import Prism from 'prismjs';

import { AbstractLabelMatcher } from '@grafana/data';

export function parseSelector(selector: string) {
  // ...
}

export function truncateResult(labels: Array<{ label: string; value: string }>, maxResults = 1000) {
  if (labels.length > maxResults) {
    return labels.slice(0, maxResults);
  }
  return labels;
}

export function escapeLabelValueInExactSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function escapeLabelValueInRegexSelector(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

export function extractLabelMatchers(tokens: Array<string | Prism.Token>): AbstractLabelMatcher[] {
  const labelMatchers: AbstractLabelMatcher[] = [];

  for (const token of tokens) {
    if (typeof token === 'string') {
      continue;
    }
    // Add label matcher extraction logic here
  }

  return labelMatchers;
}

export function processLabels(labels: Array<{ [key: string]: string }>, withName?: boolean) {
  // Move label processing logic here
  const values: { [key: string]: string[] } = {};
  return { values };
}

export function processHistogramMetrics(metrics: string[]) {
  return metrics.filter((metric) => metric.includes('_bucket'));
}
