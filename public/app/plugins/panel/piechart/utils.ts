import { FieldDisplay } from '@grafana/data';

export function filterDisplayItems(item: FieldDisplay) {
  return !item.field.custom?.hideFrom?.viz && !isNaN(item.display.numeric);
}

export function sumDisplayItemsReducer(acc: number, item: FieldDisplay) {
  return item.display.numeric + acc;
}
