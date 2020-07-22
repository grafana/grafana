import { DataFrame, Field } from '../types';
import { getFieldDisplayName } from './fieldState';
import { formatLabels } from '../utils/labels';

/**
 * This object is created often, and only used when tmplates exist.  Using a proxy lets us delay
 * calculations of the more complex structures (label names) until they are actually used
 */
export function getTemplateProxyForField(field: Field, frame?: DataFrame, frames?: DataFrame[]): any {
  return new Proxy(
    {} as any, // This object shows up in test snapshots
    {
      get: (obj: Field, key: string, reciever: any) => {
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
            __values: Object.values(field.labels)
              .sort()
              .join(', '),
            toString: () => {
              return formatLabels(field.labels!, '', true);
            },
          };
        }
        return undefined; // (field as any)[key]; // any property?
      },
    }
  );
}
