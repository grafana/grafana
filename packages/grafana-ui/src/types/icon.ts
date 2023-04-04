import { availableIconsIndex, Field, FieldType, IconName } from '@grafana/data';

import { ComponentSize } from './size';

// Exported from here for backwards compatibility
export type { IconName } from '@grafana/data';
export { toIconName } from '@grafana/data';

export type IconType = 'mono' | 'default' | 'solid';
export type IconSize = ComponentSize | 'xl' | 'xxl' | 'xxxl';

// function remains for backwards compatibility
export const getAvailableIcons = () => Object.keys(availableIconsIndex);

/**
 * Get the icon for a given field
 */
export function getFieldTypeIcon(field?: Field): IconName {
  return getFieldTypeIconName(field?.type);
}

/** Get an icon for a given field type  */
export function getFieldTypeIconName(type?: FieldType): IconName {
  if (type) {
    switch (type) {
      case FieldType.time:
        return 'clock-nine';
      case FieldType.string:
        return 'font';
      case FieldType.number:
        return 'calculator-alt';
      case FieldType.boolean:
        return 'toggle-on';
      case FieldType.trace:
        return 'info-circle';
      case FieldType.enum:
        return 'list-ol';
      case FieldType.geo:
        return 'map-marker';
      case FieldType.other:
        return 'brackets-curly';
    }
  }
  return 'question-circle';
}
