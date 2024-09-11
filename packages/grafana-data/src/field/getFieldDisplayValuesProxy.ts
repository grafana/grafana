import { toNumber } from 'lodash';

import { DataFrame, Field } from '../types/dataFrame';
import { DisplayValue } from '../types/displayValue';
import { TimeZone } from '../types/time';
import { formattedValueToString } from '../valueFormats/valueFormats';

import { getDisplayProcessor } from './displayProcessor';

function matchFieldByName(fields: Field[], key: string | symbol) {
  // try to match by name from primary frame
  return fields.find(
    (f) =>
      // 1. Match the name
      key === f.name ||
      // 2. Match by displayName
      key === f.config.displayName ||
      key === f.state?.displayName ||
      // 3. Match by labels.name
      key === f.labels?.name
  );
}

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
  frames?: DataFrame[];
  rowIndex: number;
  timeZone?: TimeZone;
}): Record<string, DisplayValue> {
  return new Proxy(
    {},
    {
      get: (obj, key): DisplayValue | undefined => {
        // 1. Match by name in primary frame
        let field = matchFieldByName(options.frame.fields, key);

        // 2. Match by name in other frames
        if (!field) {
          options.frames?.some((frame) => {
            // skip primary frame
            if (frame !== options.frame) {
              field = matchFieldByName(frame.fields, key);
            }

            // will cause .some() to exit/break if truthy
            return field;
          });
        }

        if (!field) {
          // 3. Match by array index in primary frame
          const k = toNumber(key);
          field = options.frame.fields[k];
        }

        if (!field) {
          return undefined;
        }

        // TODO: we could supply the field here for the getDisplayProcessor fallback but we would also need theme which
        //  we do not have access to here
        const displayProcessor = field.display ?? getDisplayProcessor();
        const raw = field.values[options.rowIndex];
        const disp = displayProcessor(raw);
        disp.toString = () => formattedValueToString(disp);
        return disp;
      },
    }
  );
}
