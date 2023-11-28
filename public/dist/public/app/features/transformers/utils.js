import { useMemo } from 'react';
import { getFieldDisplayName, getTimeZones } from '@grafana/data';
import { config } from '@grafana/runtime';
export function useAllFieldNamesFromDataFrames(input) {
    return useMemo(() => {
        if (!Array.isArray(input)) {
            return [];
        }
        return Object.keys(input.reduce((names, frame) => {
            if (!frame || !Array.isArray(frame.fields)) {
                return names;
            }
            return frame.fields.reduce((names, field) => {
                const t = getFieldDisplayName(field, frame, input);
                names[t] = true;
                return names;
            }, names);
        }, {}));
    }, [input]);
}
export function getDistinctLabels(input) {
    const distinct = new Set();
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
export const categoriesLabels = {
    combine: 'Combine',
    calculateNewFields: 'Calculate new fields',
    createNewVisualization: 'Create new visualization',
    filter: 'Filter',
    performSpatialOperations: 'Perform spatial operations',
    reformat: 'Reformat',
    reorderAndRename: 'Reorder and rename',
};
export const numberOrVariableValidator = (value) => {
    if (typeof value === 'number') {
        return true;
    }
    if (!Number.isNaN(Number(value))) {
        return true;
    }
    if (/^\$[A-Za-z0-9_]+$/.test(value) && config.featureToggles.transformationsVariableSupport) {
        return true;
    }
    return false;
};
export function getTimezoneOptions(includeInternal) {
    const timeZoneOptions = [];
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
//# sourceMappingURL=utils.js.map