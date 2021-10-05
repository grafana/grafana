import { Field, FieldType } from '@grafana/data';
import { ComponentSize } from './size';
import unicons from './unicons';
export type IconType = 'mono' | 'default';
export type IconSize = ComponentSize | 'xl' | 'xxl' | 'xxxl';

const brandIconNames = ['google', 'microsoft', 'github', 'gitlab', 'okta'] as const;
const customIcons = [
  'gf-grid',
  'gf-interpolation-linear',
  'gf-interpolation-smooth',
  'gf-interpolation-step-after',
  'gf-interpolation-step-before',
  'gf-landscape',
  'gf-layout-simple',
  'gf-logs',
  'gf-portrait',
] as const;
export const alwaysMonoIcons = ['grafana', 'favorite', 'heart-break', 'heart', 'panel-add', 'library-panel'] as const;
export const getAvailableIcons = () =>
  [...unicons, ...alwaysMonoIcons, ...brandIconNames, ...customIcons, 'fa fa-spinner'] as const;

export type IconName = ReturnType<typeof getAvailableIcons>[number];

/** Get the icon for a given field type */
export function getFieldTypeIcon(field?: Field): IconName {
  if (field) {
    switch (field.type) {
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
      case FieldType.other:
        return 'brackets-curly';
    }
  }
  return 'question-circle';
}
