import { DisplayValue, DataFrame, formattedValueToString, getDisplayProcessor } from '@grafana/data';
import { config } from '@grafana/runtime';
import toNumber from 'lodash/toNumber';

export function getFieldDisplayValuesProxy(frame: DataFrame, rowIndex: number): Record<string, DisplayValue> {
  return new Proxy({} as Record<string, DisplayValue>, {
    get: (obj: any, key: string) => {
      // 1. Match the name
      let field = frame.fields.find(f => key === f.name);
      if (!field) {
        // 2. Match the array index
        const k = toNumber(key);
        field = frame.fields[k];
      }
      if (!field) {
        // 3. Match the title
        field = frame.fields.find(f => key === f.config.title);
      }
      if (!field) {
        return undefined;
      }
      if (!field.display) {
        // Lazy load the display processor
        field.display = getDisplayProcessor({
          field,
          theme: config.theme,
        });
      }
      const raw = field.values.get(rowIndex);
      const disp = field.display(raw);
      disp.toString = () => formattedValueToString(disp);
      return disp;
    },
  });
}
