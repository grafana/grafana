import { useMemo } from 'react';

import {
  DataFrame,
  getFieldDisplayName,
  TransformerCategory,
  SelectableValue,
  getTimeZones,
  VariableOrigin,
  VariableSuggestion,
  SpecialValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTemplateSrv } from '@grafana/runtime';

import { variableRegex } from '../variables/utils';

export const getAllFieldNamesFromDataFrames = (frames: DataFrame[], withBaseFieldNames = false) => {
  // get full names
  let names = frames.flatMap((frame) => frame.fields.map((field) => getFieldDisplayName(field, frame, frames)));

  if (withBaseFieldNames) {
    // only add base names of fields that have same field.name
    let baseNameCounts = new Map<string, number>();

    frames.forEach((frame) =>
      frame.fields.forEach((field) => {
        let count = baseNameCounts.get(field.name) ?? 0;
        baseNameCounts.set(field.name, count + 1);
      })
    );

    let baseNames: string[] = [];

    baseNameCounts.forEach((count, name) => {
      if (count > 1) {
        baseNames.push(name);
      }
    });

    // prepend base names + uniquify
    names = [...new Set(baseNames.concat(names))];
  }

  return names;
};

export function useAllFieldNamesFromDataFrames(frames: DataFrame[], withBaseFieldNames = false): string[] {
  return useMemo(() => getAllFieldNamesFromDataFrames(frames, withBaseFieldNames), [frames, withBaseFieldNames]);
}

export function getDistinctLabels(input: DataFrame[]): Set<string> {
  const distinct = new Set<string>();
  for (const frame of input) {
    for (const field of frame.fields) {
      if (field.labels) {
        for (const k of Object.keys(field.labels)) {
          distinct.add(k);
        }
      }
    }
  }
  return distinct;
}

export const getCategoriesLabels: () => { [K in TransformerCategory]: string } = () => ({
  combine: t('transformers.utils.get-categories-labels.combine', 'Combine'),
  calculateNewFields: t('transformers.utils.get-categories-labels.calculate-new-fields', 'Calculate new fields'),
  createNewVisualization: t(
    'transformers.utils.get-categories-labels.create-new-visualization',
    'Create new visualization'
  ),
  filter: t('transformers.utils.get-categories-labels.filter', 'Filter'),
  performSpatialOperations: t(
    'transformers.utils.get-categories-labels.perform-spatial-operations',
    'Perform spatial operations'
  ),
  reformat: t('transformers.utils.get-categories-labels.reformat', 'Reformat'),
  reorderAndRename: t('transformers.utils.get-categories-labels.reorder-and-rename', 'Reorder and rename'),
});

export const numberOrVariableValidator = (value: string | number) => {
  if (typeof value === 'number') {
    return true;
  }
  if (!Number.isNaN(Number(value))) {
    return true;
  }
  const variableFound = variableRegex.test(value);
  variableRegex.lastIndex = 0;
  if (variableFound) {
    return true;
  }
  return false;
};

export function getTimezoneOptions(includeInternal: boolean) {
  const timeZoneOptions: Array<SelectableValue<string>> = [];

  // There are currently only two internal timezones
  // Browser and UTC. We add the manually to avoid
  // funky string manipulation.
  if (includeInternal) {
    timeZoneOptions.push({ label: t('transformers.get-timezone-options.label.browser', 'Browser'), value: 'browser' });
    timeZoneOptions.push({ label: t('transformers.get-timezone-options.label.utc', 'UTC'), value: 'utc' });
  }

  // Add all other timezones
  const tzs = getTimeZones();
  for (const tz of tzs) {
    timeZoneOptions.push({ label: tz, value: tz });
  }

  return timeZoneOptions;
}

export function getVariableSuggestions(): VariableSuggestion[] {
  return getTemplateSrv()
    .getVariables()
    .map((v) => ({ value: v.name, label: v.label || v.name, origin: VariableOrigin.Template }));
}

export function getEmptyOptions(): Array<SelectableValue<SpecialValue>> {
  return [
    {
      label: t('transformers.utils.special-value-options.label.null-value', 'Null'),
      description: t('transformers.utils.special-value-options.description.null-value', 'Null value'),
      value: SpecialValue.Null,
    },
    {
      label: t('transformers.utils.special-value-options.label.boolean-true', 'True'),
      description: t('transformers.utils.special-value-options.description.boolean-true', 'Boolean true value'),
      value: SpecialValue.True,
    },
    {
      label: t('transformers.utils.special-value-options.label.boolean-false', 'False'),
      description: t('transformers.utils.special-value-options.description.boolean-false', 'Boolean false value'),
      value: SpecialValue.False,
    },
    {
      label: t('transformers.utils.special-value-options.label.number-value', 'Zero'),
      description: t('transformers.utils.special-value-options.description.number-value', 'Number 0 value'),
      value: SpecialValue.Zero,
    },
    {
      label: t('transformers.utils.special-value-options.label.empty-string', 'Empty'),
      description: t('transformers.utils.special-value-options.description.empty-string', 'Empty String'),
      value: SpecialValue.Empty,
    },
  ];
}
