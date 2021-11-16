import { StyleConfig } from './types';

/** Return a distinct list of fields used to dynamically change the style */
export function getDependantFields(config: StyleConfig): Set<string> | undefined {
  const fields = new Set<string>();

  if (config.color?.field) {
    fields.add(config.color.field);
  }
  if (config.size?.field) {
    fields.add(config.size.field);
  }
  if (config.text?.field) {
    fields.add(config.text.field);
  }

  return fields;
}
