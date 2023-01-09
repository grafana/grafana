import { toNumber } from 'lodash';

import { DataFrame, DisplayValue, TimeZone } from '../types';
import { formattedValueToString } from '../valueFormats';

import { getDisplayProcessor } from './displayProcessor';

/**
 * Creates a proxy object that allows accessing fields on dataFrame through various means and then returns it's
 * display value. This is mainly useful for example in data links interpolation where you can easily create a scoped
 * variable that will allow you to access dataFrame data with ${__data.fields.fieldName}.
 * Allows accessing fields by name, index, displayName or 'name' label
 *
 * @param options
 * @internal
 */
export function getFieldDisplayValuesProxy(options: {
  frame: DataFrame;
  rowIndex: number;
  timeZone?: TimeZone;
}): Record<string, DisplayValue> {
  return new Proxy(
    {},
    {
      get: (obj, key): DisplayValue | undefined => {
        // 1. Match the name
        let field = options.frame.fields.find((f) => key === f.name);
        if (!field) {
          // 2. Match the array index
          const k = toNumber(key);
          field = options.frame.fields[k];
        }
        if (!field) {
          // 3. Match the config displayName
          field = options.frame.fields.find((f) => key === f.config.displayName);
        }
        if (!field) {
          // 4. Match the name label
          field = options.frame.fields.find((f) => {
            if (f.labels) {
              return key === f.labels.name;
            }
            return false;
          });
        }
        if (!field) {
          return undefined;
        }
        // TODO: we could supply the field here for the getDisplayProcessor fallback but we would also need theme which
        //  we do not have access to here
        const displayProcessor = field.display ?? getDisplayProcessor();
        const raw = field.values.get(options.rowIndex);
        const disp = displayProcessor(raw);
        disp.toString = () => formattedValueToString(disp);
        return disp;
      },
    }
  );
}
