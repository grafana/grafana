import { toNumber } from 'lodash';
import { DataFrame, DisplayValue, TimeZone } from '../types';
import { formattedValueToString } from '../valueFormats';

/**
 *
 * @param frame
 * @param rowIndex
 * @param options
 * @internal
 */
export function getFieldDisplayValuesProxy(options: {
  frame: DataFrame;
  rowIndex: number;
  timeZone?: TimeZone;
}): Record<string, DisplayValue> {
  return new Proxy({} as Record<string, DisplayValue>, {
    get: (obj: any, key: string) => {
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
      if (!field.display) {
        throw new Error('Field missing display processor ' + field.name);
      }
      const raw = field.values.get(options.rowIndex);
      const disp = field.display(raw);
      disp.toString = () => formattedValueToString(disp);
      return disp;
    },
  });
}
