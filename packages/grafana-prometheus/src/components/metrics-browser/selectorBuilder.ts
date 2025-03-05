import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../../language_utils';
import { isValidLegacyName, utf8Support } from '../../utf8_support';

import { FacettableValue, SelectableLabel } from './types';

export function buildSelector(selectedMetric: string, selectedLabelValues: Record<string, string[]>): string {
  if (selectedMetric === '' && Object.keys(selectedLabelValues).length === 0) {
    return '{}';
  }

  const selectorParts: string[] = [];

  Object.entries(selectedLabelValues).forEach(([key, value]) => {
    if (value.length > 1) {
      selectorParts.push(`${utf8Support(key)}=~"${value.map(escapeLabelValueInRegexSelector).join('|')}"`);
    } else if (value.length === 1) {
      selectorParts.push(`${utf8Support(key)}="${value.map(escapeLabelValueInExactSelector).join('|')}"`);
    }
  });

  if (selectedMetric !== '') {
    if (isValidLegacyName(selectedMetric)) {
      return `${selectedMetric}{${selectorParts.join(',')}}`;
    } else {
      selectorParts.unshift(utf8Support(selectedMetric));
      return `{${selectorParts.join(',')}}`;
    }
  } else {
    return `{${selectorParts.join(',')}}`;
  }
}

export function facetLabels(
  labels: SelectableLabel[],
  possibleLabels: Record<string, string[]>,
  lastFacetted?: string
): SelectableLabel[] {
  return labels.map((label) => {
    const possibleValues = possibleLabels[label.name];
    if (possibleValues) {
      let existingValues: FacettableValue[];
      if (label.name === lastFacetted && label.values) {
        // Facetting this label, show all values
        existingValues = label.values;
      } else {
        // Keep selection in other facets
        const selectedValues: Set<string> = new Set(
          label.values?.filter((value) => value.selected).map((value) => value.name) || []
        );
        // Values for this label have not been requested yet, let's use the facetted ones as the initial values
        existingValues = possibleValues.map((value) => ({ name: value, selected: selectedValues.has(value) }));
      }
      return {
        ...label,
        loading: false,
        values: existingValues,
        hidden: !possibleValues,
        facets: existingValues.length,
      };
    }

    // Label is facetted out, hide all values
    return { ...label, loading: false, hidden: !possibleValues, values: undefined, facets: 0 };
  });
}
