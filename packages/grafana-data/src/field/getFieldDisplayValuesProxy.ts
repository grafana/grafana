import { toNumber } from 'lodash';

import { fieldReducers, reduceField } from '../transformations/fieldReducer';
import { type DataFrame } from '../types/dataFrame';
import { type DisplayValue } from '../types/displayValue';
import { type TimeZone } from '../types/time';
import { formattedValueToString } from '../valueFormats/baseFormatters';

import { getDisplayProcessor } from './displayProcessor';

/**
 * Creates a proxy object that allows accessing fields on dataFrame through various means and then returns it's
 * display value. This is mainly useful for example in data links interpolation where you can easily create a scoped
 * variable that will allow you to access dataFrame data with ${__data.fields.fieldName}.
 * Allows accessing fields by name, index, displayName or 'name' label
 *
 * Pass `reducer` instead of `rowIndex` to get each field's value reduced across all rows.
 *
 * @param options
 * @internal
 */
export function getFieldDisplayValuesProxy(
  options: { frame: DataFrame; timeZone?: TimeZone } & ({ rowIndex: number } | { reducer: string })
): Record<string, DisplayValue> {
  return new Proxy(
    {},
    {
      get: (obj, key): DisplayValue | undefined | (() => string) => {
        if (key === Symbol.toPrimitive) {
          return () => '';
        }

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
        const reduced = 'reducer' in options;
        const raw = reduced
          ? reduceField({ field, reducers: [options.reducer] })[options.reducer]
          : field.values[options.rowIndex];
        // Reducers like count return how many values there are, not a value in the field's unit.
        const keepsUnit = !reduced || fieldReducers.getIfExists(options.reducer)?.preservesUnits !== false;
        const displayProcessor = (keepsUnit ? field.display : undefined) ?? getDisplayProcessor();
        const disp = displayProcessor(raw);
        disp.toString = () => formattedValueToString(disp);
        return disp;
      },
    }
  );
}
