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
