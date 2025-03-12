import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../../language_utils';
import { isValidLegacyName, utf8Support } from '../../utf8_support';

import { FacettableValue, METRIC_LABEL, SelectableLabel } from './types';

export function buildSelector(labels: SelectableLabel[]): string {
  let singleMetric = '';
  const selectedLabels: string[] = [];
  for (const label of labels) {
    if ((label.name === METRIC_LABEL || label.selected) && label.values && label.values.length > 0) {
      const selectedValues = label.values.filter((value) => value.selected).map((value) => value.name);
      if (selectedValues.length > 1) {
        selectedLabels.push(
          `${utf8Support(label.name)}=~"${selectedValues.map(escapeLabelValueInRegexSelector).join('|')}"`
        );
      } else if (selectedValues.length === 1) {
        if (label.name === METRIC_LABEL) {
          singleMetric = selectedValues[0];
        } else {
          selectedLabels.push(`${utf8Support(label.name)}="${escapeLabelValueInExactSelector(selectedValues[0])}"`);
        }
      }
    }
  }

  const selectorParts: string[] = [];
  const isLegacyName = singleMetric === '' || isValidLegacyName(singleMetric);

  if (isLegacyName) {
    selectorParts.push(singleMetric, '{');
  } else {
    selectorParts.push('{', `"${singleMetric}"`);
    if (selectedLabels.length > 0) {
      selectorParts.push(',');
    }
  }

  selectorParts.push(selectedLabels.join(','), '}');
  return selectorParts.join('');
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
