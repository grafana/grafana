import {
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  reduceField,
  fieldReducers,
} from '@grafana/data';
import { FooterItem } from '@grafana/ui/src/components/Table/types';
import { config } from 'app/core/config';

import { TableFooterCalc } from './models.gen';

export function getFooterCells(frame: DataFrame, options?: TableFooterCalc): FooterItem[] {
  return frame.fields.map((field, i) => {
    if (field.type !== FieldType.number) {
      // show the reducer in the first column
      if (i === 0 && options && options.reducer.length > 0) {
        const reducer = fieldReducers.get(options.reducer[0]);
        return reducer.name;
      }
      return undefined;
    }
    if (options?.fields && options.fields.length > 0) {
      const f = options.fields.find((f) => f === field.name);
      if (f) {
        return getFormattedValue(field, options.reducer);
      }
      return undefined;
    }
    return getFormattedValue(field, options?.reducer || []);
  });
}

function getFormattedValue(field: Field, reducer: string[]) {
  const fmt = field.display ?? getDisplayProcessor({ field, theme: config.theme2 });
  const calc = reducer[0];
  const v = reduceField({ field, reducers: reducer })[calc];
  return formattedValueToString(fmt(v));
}
