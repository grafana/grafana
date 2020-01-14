import { DisplayValue, DataFrame, formattedValueToString, getDisplayProcessor } from '@grafana/data';
import { config } from '@grafana/runtime';

export function getRowDisplayValuesProxy(frame: DataFrame, rowIndex: number): Record<string, DisplayValue> {
  return new Proxy({} as Record<string, DisplayValue>, {
    get: (obj: any, name: string | number) => {
      let field = frame.fields.find(f => name === f.name);
      if (!field) {
        field = frame.fields[name as number];
      }
      if (!field) {
        const text = `Unknown Field: ${name}`;
        return {
          text,
          toString: () => text,
        };
      }
      if (!field.display) {
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
