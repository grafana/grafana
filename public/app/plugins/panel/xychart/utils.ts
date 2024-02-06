import { Field, formattedValueToString } from '@grafana/data';

export function fmt(field: Field, val: number): string {
  if (field.display) {
    return formattedValueToString(field.display(val));
  }

  return `${val}`;
}
