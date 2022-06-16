import { DataFrame } from '@grafana/data';

export function nullToValue(frame: DataFrame) {
  frame.fields.forEach((f) => {
    const noValue = +f.config?.noValue!;
    if (!Number.isNaN(noValue)) {
      const values = f.values.toArray();
      for (let i = 0; i < values.length; i++) {
        if (values[i] === null) {
          values[i] = noValue;
        }
      }
    }
  });

  return frame;
}
