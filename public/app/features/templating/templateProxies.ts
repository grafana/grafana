import { Field, DataFrame, getFieldDisplayName, formatLabels } from '@grafana/data';

/**
 * This object is created often, and only used when tmplates exist.  Using a proxy lets us delay
 * calculations of the more complex structures (label names) until they are actually used
 */
export function getTemplateProxyForField(field: Field, frame?: DataFrame, frames?: DataFrame[]): any {
  return new Proxy(
    {}, // This object shows up in test snapshots
    {
      get: (obj, key) => {
        if (key === 'name') {
          return field.name;
        }

        if (key === 'displayName') {
          return getFieldDisplayName(field, frame, frames);
        }

        if (key === 'labels' || key === 'formattedLabels') {
          // formattedLabels deprecated
          if (!field.labels) {
            return '';
          }
          return {
            ...field.labels,
            __values: Object.values(field.labels).sort().join(', '),
            toString: () => {
              return formatLabels(field.labels!, '', true);
            },
          };
        }
        return undefined;
      },
    }
  );
}
