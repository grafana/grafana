import { useMemo } from 'react';

import {
  DataFrame,
  getFieldDisplayName,
  TransformerCategory,
  SelectableValue,
  getTimeZones,
  VariableOrigin,
  VariableSuggestion,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';

export function useAllFieldNamesFromDataFrames(input: DataFrame[]): string[] {
  return useMemo(() => {
    if (!Array.isArray(input)) {
      return [];
    }

    return Object.keys(
      input.reduce<Record<string, boolean>>((names, frame) => {
        if (!frame || !Array.isArray(frame.fields)) {
          return names;
        }

        return frame.fields.reduce((names, field) => {
          const t = getFieldDisplayName(field, frame, input);
          names[t] = true;
          return names;
        }, names);
      }, {})
    );
  }, [input]);
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

export const categoriesLabels: { [K in TransformerCategory]: string } = {
  combine: 'Combine',
  calculateNewFields: 'Calculate new fields',
  createNewVisualization: 'Create new visualization',
  filter: 'Filter',
  performSpatialOperations: 'Perform spatial operations',
  reformat: 'Reformat',
  reorderAndRename: 'Reorder and rename',
};

export const numberOrVariableValidator = (value: string | number) => {
  if (typeof value === 'number') {
    return true;
  }
  if (!Number.isNaN(Number(value))) {
    return true;
  }
  if (/^\$[A-Za-z0-9_]+$/.test(value)) {
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
    timeZoneOptions.push({ label: 'Browser', value: 'browser' });
    timeZoneOptions.push({ label: 'UTC', value: 'utc' });
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
