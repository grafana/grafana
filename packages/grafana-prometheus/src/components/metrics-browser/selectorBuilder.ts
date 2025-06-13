import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../../language_utils';
import { isValidLegacyName, utf8Support } from '../../utf8_support';

/**
 * Builds a Prometheus selector string from a metric name and label values
 * @param selectedMetric - The metric name, can be empty
 * @param selectedLabelValues - Record of label names to their selected values
 * @returns A properly formatted Prometheus selector string
 */
export function buildSelector(selectedMetric: string, selectedLabelValues: Record<string, string[]>): string {
  // Handle empty case
  if (selectedMetric === '' && Object.keys(selectedLabelValues).length === 0) {
    return '{}';
  }

  // Build all label selectors
  const selectorParts: string[] = [];

  // Process label selectors
  for (const [key, values] of Object.entries(selectedLabelValues)) {
    // Skip empty value arrays
    if (values.length === 0) {
      continue;
    }

    // Use regex matcher for multiple values
    if (values.length > 1) {
      selectorParts.push(`${utf8Support(key)}=~"${values.map(escapeLabelValueInRegexSelector).join('|')}"`);
    } else {
      // Use exact matcher for single value
      selectorParts.push(`${utf8Support(key)}="${escapeLabelValueInExactSelector(values[0])}"`);
    }
  }

  // Handle metric name cases
  if (selectedMetric === '') {
    return `{${selectorParts.join(',')}}`;
  }

  if (isValidLegacyName(selectedMetric)) {
    return `${selectedMetric}{${selectorParts.join(',')}}`;
  }

  // Add quoted metric as another selector when it's not a valid legacy name
  selectorParts.unshift(utf8Support(selectedMetric));
  return `{${selectorParts.join(',')}}`;
}
